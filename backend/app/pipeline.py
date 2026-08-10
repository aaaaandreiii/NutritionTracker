from __future__ import annotations

import asyncio
import os
import re
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import httpx
from PIL import Image, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

from .extraction import (
    DEFAULT_VISION_MODEL,
    ExtractedLabel,
    ExtractionResult,
    LabelExtractionError,
    extract_label_fields_from_images,
)
from .glycemic import build_glycemic_evidence
from .schemas import (
    AnalysisDiagnostics,
    AnalysisResult,
    EvidenceReference,
    EvidenceValue,
    GlycemicEvidence,
    MethodDiagnostic,
    NutrientCorrections,
    NutrientFields,
    PanelDiagnostic,
    PanelDiagnostics,
    ProductIdentity,
    Provenance,
    QualityCheck,
    ServingInformation,
    ValidationCheck,
)
from .taxonomy import SUGAR_TAXONOMY_VERSION, classify_ingredients
from .telemetry import emit_telemetry
from .validation import contains_prohibited_claim, validate_nutrients


PIPELINE_VERSION = "research-mvp-vlm-0.3.0"
JOB_TTL_SECONDS = 15 * 60
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 36_000_000
OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v3/product/{barcode}.json"


@dataclass(frozen=True)
class FieldSpec:
    field_id: str
    label_attr: str
    unit: str | None = None
    basis: str | None = "per labeled serving"
    image_kind: Literal["nutrition", "ingredients", "front"] = "nutrition"
    value_kind: Literal["number", "text"] = "number"


FIELD_SPECS: tuple[FieldSpec, ...] = (
    FieldSpec("productName", "product_name", basis=None, image_kind="front", value_kind="text"),
    FieldSpec("brand", "brand", basis=None, image_kind="front", value_kind="text"),
    FieldSpec("servingSize", "serving_size"),
    FieldSpec("servingUnit", "serving_unit", basis=None, value_kind="text"),
    FieldSpec("servingsPerContainer", "servings_per_container", basis="container"),
    FieldSpec("totalCarbohydrate", "total_carbohydrate", unit="g"),
    FieldSpec("fiber", "fiber", unit="g"),
    FieldSpec("totalSugars", "total_sugars", unit="g"),
    FieldSpec("addedSugars", "added_sugars", unit="g"),
    FieldSpec("sugarAlcohols", "sugar_alcohols", unit="g"),
    FieldSpec("protein", "protein", unit="g"),
    FieldSpec("fat", "fat", unit="g"),
    FieldSpec("rawIngredients", "raw_ingredients", basis=None, image_kind="ingredients", value_kind="text"),
)
FIELD_SPEC_BY_ID = {spec.field_id: spec for spec in FIELD_SPECS}


@dataclass
class MethodExtractionOutcome:
    status: Literal["complete", "partial", "skipped", "failed"]
    extraction: ExtractionResult | None = None
    failure_reason: str | None = None
    validation_checks: list[ValidationCheck] = field(default_factory=list)
    validation_failures: list[str] = field(default_factory=list)
    image_panels: list[str] = field(default_factory=list)

    @property
    def validation_passed(self) -> bool:
        return self.extraction is not None and self.status == "complete" and not self.validation_failures


@dataclass
class AnalysisJob:
    analysis_id: str
    market: Literal["PH", "US"]
    temp_dir: Path
    image_paths: dict[str, Path]
    quality_checks: list[QualityCheck]
    barcode: str | None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    result: AnalysisResult | None = None
    events: list[dict[str, Any]] = field(default_factory=list)
    changed: asyncio.Condition = field(default_factory=asyncio.Condition)
    done: bool = False

    async def publish(self, event: dict[str, Any]) -> None:
        async with self.changed:
            self.events.append(event)
            self.changed.notify_all()


def unavailable(unit: str | None = None, serving_basis: str | None = "per labeled serving") -> EvidenceValue[Any]:
    return EvidenceValue(
        value=None,
        unit=unit,
        serving_basis=serving_basis,
        source_kind="unavailable",
        status="Unavailable",
        evidence=None,
        confidence=None,
        conflict=False,
        confirmed=False,
    )


def database_value(
    value: Any,
    *,
    unit: str | None = None,
    basis: str | None = None,
    url: str,
) -> EvidenceValue[Any]:
    if value is None:
        return unavailable(unit, basis)
    return EvidenceValue(
        value=value,
        unit=unit,
        serving_basis=basis,
        source_kind="database",
        status="Database match",
        evidence=EvidenceReference(
            url=url,
            note="Community-contributed record; confirm against the photographed current label.",
        ),
        confidence=0.55,
        conflict=False,
        confirmed=False,
    )


def label_value(
    value: Any,
    *,
    unit: str | None = None,
    basis: str | None = "per labeled serving",
    image_kind: str = "nutrition",
    confidence: float | None = None,
) -> EvidenceValue[Any]:
    if value is None or (isinstance(value, str) and not value.strip()):
        return unavailable(unit, basis)
    return EvidenceValue(
        value=value.strip() if isinstance(value, str) else value,
        unit=unit,
        serving_basis=basis,
        source_kind="label",
        status="Read from label",
        evidence=EvidenceReference(
            image_kind=image_kind,  # type: ignore[arg-type]
            note="Automated vision extraction from the photographed label; user confirmation required.",
        ),
        confidence=confidence,
        conflict=False,
        confirmed=False,
    )


def user_value(
    value: Any,
    *,
    unit: str | None = None,
    basis: str | None = "per labeled serving",
    image_kind: str = "nutrition",
) -> EvidenceValue[Any]:
    if value is None or (isinstance(value, str) and not value.strip()):
        return unavailable(unit, basis)
    return EvidenceValue(
        value=value.strip() if isinstance(value, str) else value,
        unit=unit,
        serving_basis=basis,
        source_kind="user",
        status="User confirmed",
        evidence=EvidenceReference(
            image_kind=image_kind,
            note="Manually confirmed by the user from the current package.",
        ),
        confidence=None,
        conflict=False,
        confirmed=True,
    )


def _number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and value >= 0:
        return round(float(value), 3)
    return None


def _serving_size(value: Any) -> tuple[float | None, str | None, str | None]:
    if not isinstance(value, str):
        return None, None, None
    match = re.search(r"([0-9]+(?:[.,][0-9]+)?)\s*(g|ml|mL|oz)\b", value)
    if not match:
        return None, None, value[:100]
    return float(match.group(1).replace(",", ".")), match.group(2), value[:100]


def classify_glare(clipped_pixel_ratio: float, contrast: float, edge_mean: float) -> str:
    """Treat clipped pixels as blocking glare only when readable detail is also absent."""
    lacks_readable_detail = contrast < 20 or edge_mean < 4
    if clipped_pixel_ratio > 0.65 and lacks_readable_detail:
        return "fail"
    if clipped_pixel_ratio > 0.10:
        return "warn"
    return "pass"


def inspect_and_sanitize_image(data: bytes, mime_type: str, target: Path, kind: str) -> list[QualityCheck]:
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("Each image must be 8 MB or smaller.")
    if mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise ValueError("Images must be JPEG, PNG, or WebP.")

    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
    try:
        from io import BytesIO

        with Image.open(BytesIO(data)) as opened:
            opened.verify()
        with Image.open(BytesIO(data)) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            width, height = image.size
            if width * height > MAX_IMAGE_PIXELS:
                raise ValueError("Image dimensions are too large.")
            if min(width, height) < 600:
                raise ValueError("Image is too small to read reliably (600 px minimum short edge).")

            preview = image.copy()
            preview.thumbnail((640, 640))
            gray = preview.convert("L")
            stats = ImageStat.Stat(gray)
            contrast = stats.stddev[0]
            edge_mean = ImageStat.Stat(gray.filter(ImageFilter.FIND_EDGES)).mean[0]
            histogram = gray.histogram()
            glare_ratio = sum(histogram[249:]) / max(1, preview.width * preview.height)

            image.save(target, format="JPEG", quality=92, optimize=True)
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("The uploaded file is not a valid readable image.") from exc

    focus_status = "warn" if contrast < 32 or edge_mean < 7 else "pass"
    glare_status = classify_glare(glare_ratio, contrast, edge_mean)
    display_glare_status = "warn" if glare_status == "fail" else glare_status
    return [
        QualityCheck(code=f"{kind}_resolution", label=f"{kind.title()} resolution", status="pass", detail=f"{width} x {height} px; EXIF removed."),
        QualityCheck(
            code=f"{kind}_focus",
            label=f"{kind.title()} focus",
            status=focus_status,
            detail=(
                "Text detail is weak. Retake closer, hold steady, and make the label fill more of the frame."
                if focus_status == "warn"
                else "Edge detail and contrast were measured from the sanitized image."
            ),
        ),
        QualityCheck(
            code=f"{kind}_glare",
            label=f"{kind.title()} glare",
            status=display_glare_status,
            detail=(
                "Large clipped areas may hide printed values. Retake at a different light angle if fields are missing."
                if glare_status == "fail"
                else "Bright areas were detected, but text detail remains usable; confirm no values are hidden."
                if glare_status == "warn"
                else "No significant clipped areas were detected."
            ),
        ),
    ]


async def lookup_open_food_facts(barcode: str) -> tuple[dict[str, Any] | None, str | None]:
    if os.getenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "false").casefold() != "true":
        return None, None
    url = OPEN_FOOD_FACTS_URL.format(barcode=barcode)
    params = {"fields": "code,product_name,brands,nutriments,serving_size,servings_per_container"}
    try:
        async with httpx.AsyncClient(timeout=5.0, headers={"User-Agent": "Sugar-pAI-Research-MVP/0.1"}) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
        if payload.get("status") != "success" or not payload.get("product"):
            return None, url
        return payload["product"], url
    except (httpx.HTTPError, ValueError):
        return None, url


def _short_reason(value: str | None, limit: int = 800) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned if len(cleaned) <= limit else f"{cleaned[:limit - 3]}..."


def _quality_warnings(job: AnalysisJob, panel: str) -> list[str]:
    warnings: list[str] = []
    for check in job.quality_checks:
        if check.code.startswith(f"{panel}_") and check.status != "pass":
            warnings.append(check.detail)
    return warnings


def _panel_diagnostic(job: AnalysisJob, panel: str) -> PanelDiagnostic:
    if panel not in job.image_paths:
        return PanelDiagnostic(status="skipped", warnings=["Panel was not supplied."])

    warnings = _quality_warnings(job, panel)
    return PanelDiagnostic(
        status="failed" if any(check.code.startswith(f"{panel}_") and check.status == "fail" for check in job.quality_checks) else "complete",
        warnings=list(dict.fromkeys(warnings)),
    )


def _method_diagnostic(outcome: MethodExtractionOutcome | None) -> MethodDiagnostic | None:
    if outcome is None:
        return None
    extraction = outcome.extraction
    validation_failures = [
        reason
        for reason in (_short_reason(value, 500) for value in [
            *(extraction.validation_failures if extraction else []),
            *outcome.validation_failures,
        ])
        if reason
    ]
    return MethodDiagnostic(
        status=outcome.status,
        model=extraction.model if extraction else os.getenv("SUGAR_PAI_VISION_MODEL", DEFAULT_VISION_MODEL),
        latency_ms=extraction.latency_ms if extraction else None,
        failure_reason=_short_reason(outcome.failure_reason),
        attempts=extraction.attempts if extraction else 0,
        token_counts=extraction.token_counts if extraction else {},
        validation_failures=list(dict.fromkeys(validation_failures)),
        image_panels=outcome.image_panels,
    )


def build_analysis_diagnostics(
    job: AnalysisJob,
    *,
    vlm: MethodExtractionOutcome | None = None,
    fallback_reason: str | None = None,
) -> AnalysisDiagnostics:
    if vlm:
        extraction_status = vlm.status
        vision_model = vlm.extraction.model if vlm.extraction else os.getenv("SUGAR_PAI_VISION_MODEL", DEFAULT_VISION_MODEL)
        reason = vlm.failure_reason or fallback_reason
    elif fallback_reason:
        extraction_status = "failed"
        vision_model = os.getenv("SUGAR_PAI_VISION_MODEL", DEFAULT_VISION_MODEL)
        reason = fallback_reason
    else:
        extraction_status = "skipped"
        vision_model = os.getenv("SUGAR_PAI_VISION_MODEL", DEFAULT_VISION_MODEL)
        reason = None

    return AnalysisDiagnostics(
        vision_model=vision_model,
        extraction_status=extraction_status,
        fallback_reason=_short_reason(reason),
        panels=PanelDiagnostics(
            nutrition=_panel_diagnostic(job, "nutrition"),
            ingredients=_panel_diagnostic(job, "ingredients"),
            front=_panel_diagnostic(job, "front"),
        ),
        vlm=_method_diagnostic(vlm),
    )


def result_from_database(
    job: AnalysisJob,
    product: dict[str, Any] | None,
    source_url: str | None,
    processors: list[str],
    diagnostics: AnalysisDiagnostics | None = None,
) -> AnalysisResult:
    source_url = source_url or "https://world.openfoodfacts.org/"
    nutriments = product.get("nutriments", {}) if product else {}
    serving_raw = product.get("serving_size") if product else None
    serving_size, serving_unit, household = _serving_size(serving_raw)
    has_serving = serving_size is not None
    suffix = "serving" if has_serving else "100g"
    basis = "per database serving" if has_serving else "per 100 g database basis"

    def nutrient(key: str) -> EvidenceValue[float]:
        if not product:
            return unavailable("g")
        return database_value(_number(nutriments.get(f"{key}_{suffix}")), unit="g", basis=basis, url=source_url)

    barcode_value = database_value(job.barcode, url=source_url) if job.barcode else unavailable(None, None)
    result = AnalysisResult(
        analysis_id=job.analysis_id,
        status="partial",
        market=job.market,
        product=ProductIdentity(
            name=database_value(product.get("product_name") if product else None, url=source_url, basis=None),
            brand=database_value(product.get("brands") if product else None, url=source_url, basis=None),
            barcode=barcode_value,
        ),
        serving=ServingInformation(
            size=database_value(serving_size, unit=serving_unit, basis="database serving", url=source_url) if product else unavailable(None, "per labeled serving"),
            unit=serving_unit,
            household_measure=household,
            servings_per_container=database_value(_number(product.get("servings_per_container")) if product else None, basis="container", url=source_url),
        ),
        nutrients=NutrientFields(
            total_carbohydrate=nutrient("carbohydrates"),
            fiber=nutrient("fiber"),
            total_sugars=nutrient("sugars"),
            added_sugars=nutrient("added-sugars"),
            sugar_alcohols=nutrient("polyols"),
            protein=nutrient("proteins"),
            fat=nutrient("fat"),
        ),
        raw_ingredients=unavailable(None),
        sugar_variants=[],
        glycemic=GlycemicEvidence(
            status="unavailable",
            reason=(
                "No eligible tested-product GI evidence was matched. Sourced GI is not bundled, and demo GL "
                "requires confirmed label carbohydrate, fiber, and sugar-alias evidence."
            ),
        ),
        quality_checks=job.quality_checks,
        validation_checks=[ValidationCheck(
            code="manual_review_required",
            status="review",
            message="No vision extraction produced accepted label evidence. Confirm values manually from the current package.",
        )],
        limitations=[
            "Live label extraction did not produce accepted evidence; database values, if present, are unconfirmed.",
            "Ingredient order cannot establish grams of an individual sweetener.",
            "No licensed FNRI, Trinidad, or tested-product GI table is bundled.",
            "This tool does not provide medical advice, diabetes safety claims, medication guidance, or glucose predictions.",
        ],
        diagnostics=diagnostics or build_analysis_diagnostics(job),
        retake_recommended=any(check.status == "warn" for check in job.quality_checks),
        retake_reasons=build_retake_reasons(job, None),
        provenance=Provenance(
            pipeline_version=PIPELINE_VERSION,
            completed_at=datetime.now(timezone.utc),
            external_processors=processors,
        ),
    )
    return result


def _extracted_corrections(label: ExtractedLabel) -> NutrientCorrections:
    return NutrientCorrections(
        total_carbohydrate=label.total_carbohydrate,
        fiber=label.fiber,
        total_sugars=label.total_sugars,
        added_sugars=label.added_sugars,
        sugar_alcohols=label.sugar_alcohols,
        protein=label.protein,
        fat=label.fat,
    )


def _with_label_fallback(
    extracted: Any,
    fallback: EvidenceValue[Any],
    *,
    unit: str | None = None,
    basis: str | None = "per labeled serving",
    image_kind: str = "nutrition",
    confidence: float | None = None,
) -> EvidenceValue[Any]:
    if extracted is None or (isinstance(extracted, str) and not extracted.strip()):
        return fallback
    return label_value(
        extracted,
        unit=unit,
        basis=basis,
        image_kind=image_kind,
        confidence=confidence,
    )


def result_from_extraction(
    job: AnalysisJob,
    extraction: ExtractionResult,
    product: dict[str, Any] | None,
    source_url: str | None,
    processors: list[str],
    diagnostics: AnalysisDiagnostics | None = None,
) -> AnalysisResult:
    label = extraction.label
    validation_checks = validate_nutrients(_extracted_corrections(label))
    failed = next((check for check in validation_checks if check.status == "fail"), None)
    if failed:
        raise ValueError(f"Extracted label arithmetic failed validation: {failed.message}")

    base = result_from_database(job, product, source_url, processors)
    confidence = label.confidence
    ingredients_kind = "ingredients" if "ingredients" in job.image_paths else "nutrition"
    raw_ingredients = _with_label_fallback(
        label.raw_ingredients,
        base.raw_ingredients,
        basis=None,
        image_kind=ingredients_kind,
        confidence=confidence,
    )
    sugar_variants = classify_ingredients(raw_ingredients.value or "")

    nutrients = NutrientFields(
        total_carbohydrate=_with_label_fallback(label.total_carbohydrate, base.nutrients.total_carbohydrate, unit="g", confidence=confidence),
        fiber=_with_label_fallback(label.fiber, base.nutrients.fiber, unit="g", confidence=confidence),
        total_sugars=_with_label_fallback(label.total_sugars, base.nutrients.total_sugars, unit="g", confidence=confidence),
        added_sugars=_with_label_fallback(label.added_sugars, base.nutrients.added_sugars, unit="g", confidence=confidence),
        sugar_alcohols=_with_label_fallback(label.sugar_alcohols, base.nutrients.sugar_alcohols, unit="g", confidence=confidence),
        protein=_with_label_fallback(label.protein, base.nutrients.protein, unit="g", confidence=confidence),
        fat=_with_label_fallback(label.fat, base.nutrients.fat, unit="g", confidence=confidence),
    )
    glycemic, glycemic_limitations = build_glycemic_evidence(
        nutrients,
        sugar_variants,
        product_name=str(label.product_name or base.product.name.value or ""),
        raw_ingredients=raw_ingredients.value or "",
    )

    product_name = _with_label_fallback(
        label.product_name,
        base.product.name,
        basis=None,
        image_kind="front" if "front" in job.image_paths else "nutrition",
        confidence=confidence,
    )
    brand = _with_label_fallback(
        label.brand,
        base.product.brand,
        basis=None,
        image_kind="front" if "front" in job.image_paths else "nutrition",
        confidence=confidence,
    )
    serving_size = _with_label_fallback(
        label.serving_size,
        base.serving.size,
        unit=label.serving_unit or base.serving.unit,
        basis="per labeled serving",
        confidence=confidence,
    )

    limitations = [
        "Automated readings are unconfirmed vision outputs; manual review is required before logging.",
        f"Ingredient matches use taxonomy {SUGAR_TAXONOMY_VERSION}; they do not estimate ingredient amounts.",
        "Ingredient order cannot establish grams of an individual sweetener.",
        "This tool does not provide medical advice, diabetes safety claims, medication guidance, or glucose predictions.",
        *glycemic_limitations,
    ]
    if product:
        limitations.append("Open Food Facts values, if present, are community data and do not replace the current photographed label.")

    retake_reasons = build_retake_reasons(job, nutrients)
    return AnalysisResult(
        analysis_id=job.analysis_id,
        status="ready",
        market=job.market,
        product=ProductIdentity(
            name=product_name,
            brand=brand,
            barcode=base.product.barcode,
        ),
        serving=ServingInformation(
            size=serving_size,
            unit=label.serving_unit or base.serving.unit,
            household_measure=label.household_measure or base.serving.household_measure,
            servings_per_container=_with_label_fallback(
                label.servings_per_container,
                base.serving.servings_per_container,
                basis="container",
                confidence=confidence,
            ),
        ),
        nutrients=nutrients,
        raw_ingredients=raw_ingredients,
        sugar_variants=sugar_variants,
        glycemic=glycemic,
        quality_checks=job.quality_checks,
        validation_checks=[
            *validation_checks,
            ValidationCheck(
                code="manual_review_required",
                status="review",
                message="Review every automated label value against the photo before saving.",
            ),
        ],
        limitations=list(dict.fromkeys(limitations)),
        diagnostics=diagnostics or build_analysis_diagnostics(job),
        retake_recommended=bool(retake_reasons),
        retake_reasons=retake_reasons,
        provenance=Provenance(
            pipeline_version=PIPELINE_VERSION,
            completed_at=datetime.now(timezone.utc),
            external_processors=processors,
        ),
    )


async def run_vlm_method(job: AnalysisJob) -> MethodExtractionOutcome:
    panels = [panel for panel in ("nutrition", "ingredients", "front") if panel in job.image_paths]
    try:
        extraction = await extract_label_fields_from_images(job.image_paths)
        validation_checks, validation_failures = validate_extracted_label(extraction.label)
        return MethodExtractionOutcome(
            status="failed" if validation_failures else "complete",
            extraction=extraction,
            failure_reason="; ".join(validation_failures) if validation_failures else None,
            validation_checks=validation_checks,
            validation_failures=validation_failures,
            image_panels=panels,
        )
    except LabelExtractionError as exc:
        return MethodExtractionOutcome(
            status="failed",
            failure_reason=str(exc),
            image_panels=panels,
        )


def validate_extracted_label(label: ExtractedLabel) -> tuple[list[ValidationCheck], list[str]]:
    checks = validate_nutrients(_extracted_corrections(label))
    failures = [check.message for check in checks if check.status == "fail"]
    claim_text = json_like_text(label)
    if contains_prohibited_claim(claim_text):
        failures.append("Extraction output contained a prohibited health or diabetes safety claim.")
        checks.append(ValidationCheck(
            code="prohibited_claim_suppressed",
            status="fail",
            message="Extraction output contained a prohibited health or diabetes safety claim.",
        ))
    return checks, failures


def json_like_text(label: ExtractedLabel) -> str:
    return " ".join(
        str(value)
        for value in label.model_dump(exclude_none=True).values()
        if value is not None
    )


def build_retake_reasons(job: AnalysisJob, nutrients: NutrientFields | None, vlm: MethodExtractionOutcome | None = None) -> list[str]:
    reasons: list[str] = []
    if any(check.status == "warn" for check in job.quality_checks):
        reasons.append("Image readability warnings were detected; retake closer or reduce glare if values are hard to verify.")
    if nutrients is not None:
        missing_required = []
        if nutrients.total_carbohydrate.value is None:
            missing_required.append("total carbohydrate")
        if nutrients.total_sugars.value is None:
            missing_required.append("total sugars")
        if missing_required:
            reasons.append(f"Required nutrition rows are missing: {', '.join(missing_required)}.")
    if vlm and vlm.status == "failed" and vlm.failure_reason:
        reasons.append(f"Vision extraction could not produce accepted label evidence: {vlm.failure_reason}")
    return list(dict.fromkeys(reasons))


def first_extracted_ingredient_text(outcome: MethodExtractionOutcome | None) -> str | None:
    text = outcome.extraction.label.raw_ingredients if outcome and outcome.extraction else None
    return text.strip() if text and text.strip() else None


async def run_pipeline(job: AnalysisJob) -> None:
    try:
        await job.publish({"type": "stage", "stage": "image_check", "status": "running", "label": "Checking sanitized images"})
        await asyncio.sleep(0.05)
        if any(check.status == "fail" for check in job.quality_checks):
            raise ValueError("One or more images failed the server readability check. Retake them before analysis.")
        await job.publish({"type": "stage", "stage": "image_check", "status": "complete", "label": "MIME, dimensions, focus, and glare checked"})

        product: dict[str, Any] | None = None
        source_url: str | None = None
        processors: list[str] = []
        if job.barcode:
            await job.publish({"type": "stage", "stage": "barcode_lookup", "status": "running", "label": "Checking product identity"})
            product, source_url = await lookup_open_food_facts(job.barcode)
            if os.getenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "false").casefold() == "true":
                processors.append("Open Food Facts")
                label = "Community record found; current label still takes precedence" if product else "No usable community record found"
                status = "complete"
            else:
                label = "External lookup disabled in this environment"
                status = "skipped"
            await job.publish({"type": "stage", "stage": "barcode_lookup", "status": status, "label": label})
        else:
            await job.publish({"type": "stage", "stage": "barcode_lookup", "status": "skipped", "label": "No barcode supplied"})

        await job.publish({
            "type": "stage",
            "stage": "label_extraction",
            "status": "running",
            "label": "Running VLM evidence assembly",
        })
        vlm_outcome = await run_vlm_method(job)
        if vlm_outcome.extraction:
            processors.append(f"Ollama {vlm_outcome.extraction.model}")
            emit_telemetry(
                "vlm_extraction_complete" if vlm_outcome.status == "complete" else "vlm_extraction_rejected",
                analysis_id=job.analysis_id,
                model=vlm_outcome.extraction.model,
                attempts=vlm_outcome.extraction.attempts,
                latency_ms=vlm_outcome.extraction.latency_ms,
                prompt_eval_count=vlm_outcome.extraction.token_counts.get("prompt_eval_count"),
                eval_count=vlm_outcome.extraction.token_counts.get("eval_count"),
                json_validation_failures=len(vlm_outcome.extraction.validation_failures),
                deterministic_validation_failures=len(vlm_outcome.validation_failures),
            )

        if vlm_outcome.status == "failed":
            fallback_reason = vlm_outcome.failure_reason or "Vision extraction failed."
            emit_telemetry(
                "label_extraction_fallback",
                analysis_id=job.analysis_id,
                model=os.getenv("SUGAR_PAI_VISION_MODEL", DEFAULT_VISION_MODEL),
                method="vlm",
                fallback_reason=fallback_reason[:250],
            )
            await job.publish({
                "type": "stage",
                "stage": "label_extraction",
                "status": "failed",
                "label": f"Vision evidence needs manual entry: {fallback_reason[:96]}",
            })
        else:
            await job.publish({
                "type": "stage",
                "stage": "label_extraction",
                "status": "complete",
                "label": "Vision fields assembled for manual review",
            })

        ingredient_status = "running" if "ingredients" in job.image_paths else "skipped"
        await job.publish({
            "type": "stage",
            "stage": "ingredient_classification",
            "status": ingredient_status,
            "label": "Checking ingredient evidence" if ingredient_status == "running" else "No ingredients panel supplied",
        })
        await asyncio.sleep(0.04)
        if ingredient_status == "running":
            ingredient_text = first_extracted_ingredient_text(vlm_outcome if vlm_outcome.validation_passed else None)
            if ingredient_text:
                variant_count = len(classify_ingredients(ingredient_text))
                await job.publish({
                    "type": "stage",
                    "stage": "ingredient_classification",
                    "status": "complete",
                    "label": f"Matched {variant_count} sugar-related ingredient aliases from vision text",
                })
            else:
                await job.publish({
                    "type": "stage",
                    "stage": "ingredient_classification",
                    "status": "skipped",
                    "label": "Ingredient text unavailable; user transcription required",
                })

        await job.publish({"type": "stage", "stage": "evidence_assembly", "status": "running", "label": "Building editable evidence record"})
        diagnostics = build_analysis_diagnostics(job, vlm=vlm_outcome)
        if vlm_outcome.validation_passed and vlm_outcome.extraction:
            try:
                result = result_from_extraction(job, vlm_outcome.extraction, product, source_url, processors, diagnostics)
            except ValueError as exc:
                vlm_outcome.status = "failed"
                vlm_outcome.failure_reason = str(exc)
                diagnostics = build_analysis_diagnostics(job, vlm=vlm_outcome)
                result = result_from_database(job, product, source_url, processors, diagnostics)
        else:
            result = result_from_database(job, product, source_url, processors, diagnostics)
            result.retake_reasons = build_retake_reasons(job, None, vlm_outcome)
            result.retake_recommended = bool(result.retake_reasons)

        accepted_count = sum(
            1
            for value in [
                result.product.name,
                result.product.brand,
                result.serving.size,
                result.nutrients.total_carbohydrate,
                result.nutrients.fiber,
                result.nutrients.total_sugars,
                result.nutrients.added_sugars,
                result.nutrients.sugar_alcohols,
                result.nutrients.protein,
                result.nutrients.fat,
                result.raw_ingredients,
            ]
            if value.source_kind == "label"
        )
        await job.publish({
            "type": "stage",
            "stage": "evidence_assembly",
            "status": "complete",
            "label": f"Accepted {accepted_count} vision-filled fields; unknowns kept blank",
        })

        await job.publish({"type": "stage", "stage": "safety_validation", "status": "running", "label": "Checking units, evidence, and prohibited claims"})
        await asyncio.sleep(0.04)
        job.result = result
        emit_telemetry(
            "analysis_complete",
            analysis_id=job.analysis_id,
            status=result.status,
            extraction_method="vlm",
            vlm_model=vlm_outcome.extraction.model if vlm_outcome.extraction else None,
            fallback_reason=diagnostics.fallback_reason[:250] if diagnostics.fallback_reason else None,
            glycemic_status=result.glycemic.status,
            gl=result.glycemic.gl,
        )
        await job.publish({"type": "stage", "stage": "safety_validation", "status": "complete", "label": "Deterministic copy only; unsupported health claims suppressed"})
        await job.publish({"type": "result", "result": result.model_dump(mode="json", by_alias=True)})
    except Exception as exc:
        await job.publish({"type": "error", "message": str(exc)})
    finally:
        job.done = True
        async with job.changed:
            job.changed.notify_all()


def clone_result(result: AnalysisResult) -> AnalysisResult:
    return deepcopy(result)

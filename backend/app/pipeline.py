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
    DEFAULT_EXTRACTION_MODEL,
    DEFAULT_VISION_MODEL,
    ExtractedLabel,
    ExtractionResult,
    LabelExtractionError,
    extract_label_fields,
    extract_label_fields_from_images,
)
from .glycemic import build_glycemic_evidence
from .ocr import OcrProviderError, OcrResult, extract_text_from_images
from .schemas import (
    AgreementStatus,
    AnalysisDiagnostics,
    AnalysisResult,
    EvidenceReference,
    EvidenceValue,
    ExtractionCandidate,
    ExtractionMode,
    ExtractionSource,
    FieldComparison,
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


PIPELINE_VERSION = "research-mvp-0.2.0"
JOB_TTL_SECONDS = 15 * 60
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 36_000_000
OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v3/product/{barcode}.json"


VALID_EXTRACTION_MODES: set[ExtractionMode] = {"both", "ocr_llm", "vlm"}


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
NUTRIENT_FIELD_IDS = {
    "totalCarbohydrate",
    "fiber",
    "totalSugars",
    "addedSugars",
    "sugarAlcohols",
    "protein",
    "fat",
}


@dataclass
class MethodExtractionOutcome:
    source: ExtractionSource
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
    extraction_mode: ExtractionMode = "both"
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


def configured_default_extraction_mode() -> ExtractionMode:
    configured = os.getenv("SUGAR_PAI_DEFAULT_EXTRACTION_MODE", "both").casefold()
    return configured if configured in VALID_EXTRACTION_MODES else "both"  # type: ignore[return-value]


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
            note="Automated extraction from the photographed label; user confirmation required.",
        ),
        confidence=confidence,
        conflict=False,
        confirmed=False,
    )


def conflict_value(
    *,
    unit: str | None = None,
    basis: str | None = "per labeled serving",
    image_kind: str = "nutrition",
    note: str = "Extraction methods disagreed; choose a candidate or type the verified label value.",
) -> EvidenceValue[Any]:
    return EvidenceValue(
        value=None,
        unit=unit,
        serving_basis=basis,
        source_kind="unavailable",
        status="Conflict",
        evidence=EvidenceReference(
            image_kind=image_kind,  # type: ignore[arg-type]
            note=note,
        ),
        confidence=None,
        conflict=True,
        confirmed=False,
    )


def user_value(value: Any, *, unit: str | None = None, basis: str | None = "per labeled serving", image_kind: str = "nutrition") -> EvidenceValue[Any]:
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
        QualityCheck(code=f"{kind}_resolution", label=f"{kind.title()} resolution", status="pass", detail=f"{width} × {height} px; EXIF removed."),
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


def _configured_ocr_provider_or_none(ocr_result: OcrResult | None) -> str | None:
    if ocr_result:
        return ocr_result.provider
    provider = os.getenv("SUGAR_PAI_OCR_PROVIDER", "tesseract").casefold()
    return provider if provider in {"tesseract", "paddle"} else None


def _short_reason(value: str | None, limit: int = 800) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned if len(cleaned) <= limit else f"{cleaned[:limit - 3]}..."


def _ocr_snippet(value: str, limit: int = 240) -> str | None:
    cleaned = re.sub(r"\s+", " ", value).strip()
    if not cleaned:
        return None
    return cleaned if len(cleaned) <= limit else f"{cleaned[:limit - 3]}..."


def _quality_warnings(job: AnalysisJob, panel: str) -> list[str]:
    warnings: list[str] = []
    for check in job.quality_checks:
        if check.code.startswith(f"{panel}_") and check.status != "pass":
            warnings.append(check.detail)
    return warnings


def _panel_diagnostic(
    job: AnalysisJob,
    panel: str,
    ocr_result: OcrResult | None,
    fallback_reason: str | None,
) -> PanelDiagnostic:
    if panel not in job.image_paths:
        return PanelDiagnostic(
            status="skipped",
            readable_characters=0,
            warnings=["Panel was not supplied."],
            snippet=None,
        )

    warnings = _quality_warnings(job, panel)
    if not ocr_result:
        if fallback_reason:
            warnings.append(_short_reason(fallback_reason, 240) or "OCR did not complete.")
        return PanelDiagnostic(
            status="failed",
            readable_characters=0,
            warnings=list(dict.fromkeys(warnings)),
            snippet=None,
        )

    text = ocr_result.text_by_panel.get(panel, "").strip()
    readable_characters = len(text)
    if readable_characters == 0:
        warnings.append("OCR read no text from this panel.")
        status = "failed"
    else:
        status = "complete"
        if readable_characters < 40:
            warnings.append(
                "Very little text was read; the label may be too small in frame or too low contrast."
            )
        elif panel in {"nutrition", "ingredients"} and readable_characters < 120:
            warnings.append(
                "OCR text is short for this panel; retake closer if important fields are missing."
            )

    return PanelDiagnostic(
        status=status,
        readable_characters=readable_characters,
        warnings=list(dict.fromkeys(warnings)),
        snippet=_ocr_snippet(text),
    )


def _method_diagnostic(outcome: MethodExtractionOutcome | None, fallback_model: str | None = None) -> MethodDiagnostic | None:
    if outcome is None:
        return None
    extraction = outcome.extraction
    validation_failures = [
        *_short_list(extraction.validation_failures if extraction else []),
        *_short_list(outcome.validation_failures),
    ]
    return MethodDiagnostic(
        status=outcome.status,
        model=extraction.model if extraction else fallback_model,
        latency_ms=extraction.latency_ms if extraction else None,
        failure_reason=_short_reason(outcome.failure_reason),
        attempts=extraction.attempts if extraction else 0,
        token_counts=extraction.token_counts if extraction else {},
        validation_failures=list(dict.fromkeys(validation_failures)),
        image_panels=outcome.image_panels,
    )


def _short_list(values: list[str], limit: int = 500) -> list[str]:
    return [reason for reason in (_short_reason(value, limit) for value in values) if reason]


def _combined_extraction_status(
    ocr_llm: MethodExtractionOutcome | None,
    vlm: MethodExtractionOutcome | None,
) -> Literal["complete", "partial", "skipped", "failed"]:
    outcomes = [outcome for outcome in (ocr_llm, vlm) if outcome is not None and outcome.status != "skipped"]
    if not outcomes:
        return "skipped"
    complete = sum(1 for outcome in outcomes if outcome.status == "complete")
    if complete == len(outcomes):
        return "complete"
    if complete > 0:
        return "partial"
    if all(outcome.status == "skipped" for outcome in outcomes):
        return "skipped"
    return "failed"


def _combined_failure_reason(*outcomes: MethodExtractionOutcome | None, fallback_reason: str | None = None) -> str | None:
    reasons = [
        outcome.failure_reason
        for outcome in outcomes
        if outcome and outcome.status == "failed" and outcome.failure_reason
    ]
    if fallback_reason:
        reasons.append(fallback_reason)
    return _short_reason(" | ".join(reasons)) if reasons else None


def build_analysis_diagnostics(
    job: AnalysisJob,
    *,
    ocr_result: OcrResult | None = None,
    extraction: ExtractionResult | None = None,
    fallback_reason: str | None = None,
    extraction_status: Literal["complete", "partial", "skipped", "failed"] | None = None,
    ocr_llm: MethodExtractionOutcome | None = None,
    vlm: MethodExtractionOutcome | None = None,
) -> AnalysisDiagnostics:
    if extraction_status is None:
        if ocr_llm is not None or vlm is not None:
            extraction_status = _combined_extraction_status(ocr_llm, vlm)
        elif extraction:
            extraction_status = "complete"
        elif ocr_result and fallback_reason:
            extraction_status = "failed"
        elif fallback_reason:
            extraction_status = "skipped"
        else:
            extraction_status = "skipped"

    ocr_status: Literal["complete", "skipped", "failed"]
    if ocr_result:
        ocr_status = "complete"
    elif ocr_llm and ocr_llm.status == "failed":
        ocr_status = "failed"
    elif fallback_reason:
        ocr_status = "failed"
    else:
        ocr_status = "skipped"

    panel_fallback_reason = fallback_reason or (
        ocr_llm.failure_reason if ocr_llm and ocr_llm.status == "failed" and not ocr_result else None
    )
    llm_model = extraction.model if extraction else (
        ocr_llm.extraction.model if ocr_llm and ocr_llm.extraction else
        os.getenv("SUGAR_PAI_EXTRACTION_MODEL", DEFAULT_EXTRACTION_MODEL) if ocr_result else None
    )
    return AnalysisDiagnostics(
        ocr_provider=_configured_ocr_provider_or_none(ocr_result),
        ocr_status=ocr_status,
        llm_model=llm_model,
        extraction_status=extraction_status,
        fallback_reason=_combined_failure_reason(ocr_llm, vlm, fallback_reason=fallback_reason),
        panels=PanelDiagnostics(
            nutrition=_panel_diagnostic(job, "nutrition", ocr_result, panel_fallback_reason),
            ingredients=_panel_diagnostic(job, "ingredients", ocr_result, panel_fallback_reason),
            front=_panel_diagnostic(job, "front", ocr_result, panel_fallback_reason),
        ),
        ocr_llm=_method_diagnostic(ocr_llm, os.getenv("SUGAR_PAI_EXTRACTION_MODEL", DEFAULT_EXTRACTION_MODEL)),
        vlm=_method_diagnostic(vlm, os.getenv("SUGAR_PAI_VISION_MODEL", DEFAULT_VISION_MODEL)),
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
        extraction_mode=job.extraction_mode,
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
            message="No OCR/LLM provider produced accepted label evidence. Confirm values manually from the current package.",
        )],
        limitations=[
            "Live label extraction did not produce accepted evidence; database values, if present, are unconfirmed.",
            "Ingredient order cannot establish grams of an individual sweetener.",
            "No licensed FNRI, Trinidad, or tested-product GI table is bundled.",
            "This tool does not provide medical advice, diabetes safety claims, medication guidance, or glucose predictions.",
        ],
        diagnostics=diagnostics or build_analysis_diagnostics(job),
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
        total_carbohydrate=_with_label_fallback(
            label.total_carbohydrate,
            base.nutrients.total_carbohydrate,
            unit="g",
            confidence=confidence,
        ),
        fiber=_with_label_fallback(label.fiber, base.nutrients.fiber, unit="g", confidence=confidence),
        total_sugars=_with_label_fallback(
            label.total_sugars,
            base.nutrients.total_sugars,
            unit="g",
            confidence=confidence,
        ),
        added_sugars=_with_label_fallback(
            label.added_sugars,
            base.nutrients.added_sugars,
            unit="g",
            confidence=confidence,
        ),
        sugar_alcohols=_with_label_fallback(
            label.sugar_alcohols,
            base.nutrients.sugar_alcohols,
            unit="g",
            confidence=confidence,
        ),
        protein=_with_label_fallback(label.protein, base.nutrients.protein, unit="g", confidence=confidence),
        fat=_with_label_fallback(label.fat, base.nutrients.fat, unit="g", confidence=confidence),
    )
    glycemic, glycemic_limitations = build_glycemic_evidence(nutrients, sugar_variants)

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
        "Automated readings are unconfirmed OCR+LLM outputs; manual review is required before logging.",
        f"Ingredient matches use taxonomy {SUGAR_TAXONOMY_VERSION}; they do not estimate ingredient amounts.",
        "Ingredient order cannot establish grams of an individual sweetener.",
        "This tool does not provide medical advice, diabetes safety claims, medication guidance, or glucose predictions.",
        *glycemic_limitations,
    ]
    if product:
        limitations.append("Open Food Facts values, if present, are community data and do not replace the current photographed label.")

    return AnalysisResult(
        analysis_id=job.analysis_id,
        status="ready",
        market=job.market,
        extraction_mode=job.extraction_mode,
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
                message="Review every OCR/LLM value against the photo before saving.",
            ),
        ],
        limitations=list(dict.fromkeys(limitations)),
        diagnostics=diagnostics or build_analysis_diagnostics(job, extraction=extraction),
        provenance=Provenance(
            pipeline_version=PIPELINE_VERSION,
            completed_at=datetime.now(timezone.utc),
            external_processors=processors,
        ),
    )


async def run_ocr_llm_method(job: AnalysisJob) -> tuple[MethodExtractionOutcome, OcrResult | None]:
    ocr_result: OcrResult | None = None
    try:
        ocr_result = await extract_text_from_images(job.image_paths)
        extraction = await extract_label_fields(ocr_result)
        validation_checks, validation_failures = validate_extracted_label(extraction.label)
        return MethodExtractionOutcome(
            source="ocr_llm",
            status="failed" if validation_failures else "complete",
            extraction=extraction,
            failure_reason="; ".join(validation_failures) if validation_failures else None,
            validation_checks=validation_checks,
            validation_failures=validation_failures,
            image_panels=list(ocr_result.text_by_panel.keys()),
        ), ocr_result
    except (OcrProviderError, LabelExtractionError) as exc:
        return MethodExtractionOutcome(
            source="ocr_llm",
            status="failed",
            failure_reason=str(exc),
            image_panels=list(job.image_paths.keys()),
        ), ocr_result


async def run_vlm_method(job: AnalysisJob) -> MethodExtractionOutcome:
    try:
        extraction = await extract_label_fields_from_images(job.image_paths)
        validation_checks, validation_failures = validate_extracted_label(extraction.label)
        return MethodExtractionOutcome(
            source="vlm",
            status="failed" if validation_failures else "complete",
            extraction=extraction,
            failure_reason="; ".join(validation_failures) if validation_failures else None,
            validation_checks=validation_checks,
            validation_failures=validation_failures,
            image_panels=[panel for panel in ("nutrition", "ingredients", "front") if panel in job.image_paths],
        )
    except LabelExtractionError as exc:
        return MethodExtractionOutcome(
            source="vlm",
            status="failed",
            failure_reason=str(exc),
            image_panels=[panel for panel in ("nutrition", "ingredients", "front") if panel in job.image_paths],
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


def result_from_extraction_comparison(
    job: AnalysisJob,
    ocr_llm: MethodExtractionOutcome | None,
    vlm: MethodExtractionOutcome | None,
    ocr_result: OcrResult | None,
    product: dict[str, Any] | None,
    source_url: str | None,
    processors: list[str],
    diagnostics: AnalysisDiagnostics | None = None,
) -> AnalysisResult:
    base = result_from_database(job, product, source_url, processors)
    extraction_candidates, field_comparisons = build_field_comparisons(job, ocr_llm, vlm, ocr_result)
    any_candidate = any(extraction_candidates.values())

    def evidence_for(field_id: str, fallback: EvidenceValue[Any] | None = None) -> EvidenceValue[Any]:
        spec = FIELD_SPEC_BY_ID[field_id]
        comparison = field_comparisons[field_id]
        candidate = comparison.ocr_candidate or comparison.vlm_candidate
        unit = candidate.unit if candidate and candidate.unit else spec.unit
        image_kind = _panel_for_spec(job, spec)
        if comparison.prefilled and candidate:
            return label_value(
                candidate.value,
                unit=unit,
                basis=spec.basis,
                image_kind=image_kind,
                confidence=_comparison_confidence(comparison),
            )
        if comparison.agreement_status == "conflict":
            return conflict_value(
                unit=unit,
                basis=spec.basis,
                image_kind=image_kind,
                note=comparison.warning_reason or "Extraction methods disagreed; choose a candidate manually.",
            )
        return fallback or unavailable(unit, spec.basis)

    serving_unit_value = _prefilled_scalar(field_comparisons["servingUnit"])
    if not serving_unit_value:
        serving_size_candidate = _prefilled_candidate(field_comparisons["servingSize"])
        serving_unit_value = serving_size_candidate.unit if serving_size_candidate and serving_size_candidate.unit else None

    raw_ingredients = evidence_for("rawIngredients")
    sugar_variants = classify_ingredients(raw_ingredients.value or "")
    nutrients = NutrientFields(
        total_carbohydrate=evidence_for("totalCarbohydrate"),
        fiber=evidence_for("fiber"),
        total_sugars=evidence_for("totalSugars"),
        added_sugars=evidence_for("addedSugars"),
        sugar_alcohols=evidence_for("sugarAlcohols"),
        protein=evidence_for("protein"),
        fat=evidence_for("fat"),
    )
    validation_checks = [
        *validate_nutrients(NutrientCorrections(
            total_carbohydrate=nutrients.total_carbohydrate.value,
            fiber=nutrients.fiber.value,
            total_sugars=nutrients.total_sugars.value,
            added_sugars=nutrients.added_sugars.value,
            sugar_alcohols=nutrients.sugar_alcohols.value,
            protein=nutrients.protein.value,
            fat=nutrients.fat.value,
        )),
        *method_review_checks(ocr_llm, vlm),
        ValidationCheck(
            code="manual_review_required",
            status="review",
            message="Only matching OCR+LLM and VLM label readings are prefilled. Choose a candidate or type the value for every blank field you can verify.",
        ),
    ]
    glycemic, glycemic_limitations = build_glycemic_evidence(nutrients, sugar_variants)
    retake_reasons = build_retake_reasons(job, field_comparisons, ocr_llm, vlm)

    limitations = [
        "Automated readings are unconfirmed label evidence; manual review is required before logging.",
        "Fields are prefilled only when the selected OCR+LLM and VLM methods agree and deterministic validation passes.",
        f"Ingredient matches use taxonomy {SUGAR_TAXONOMY_VERSION}; they do not estimate ingredient amounts.",
        "Ingredient order cannot establish grams of an individual sweetener.",
        "This tool does not provide medical advice, diabetes safety claims, medication guidance, or glucose predictions.",
        *glycemic_limitations,
    ]
    if product:
        limitations.append("Open Food Facts values, if present, are community data and do not replace the current photographed label.")
    if retake_reasons:
        limitations.append("Retake guidance is advisory and does not block manual review.")

    return AnalysisResult(
        analysis_id=job.analysis_id,
        status="ready" if any_candidate else "partial",
        market=job.market,
        extraction_mode=job.extraction_mode,
        product=ProductIdentity(
            name=evidence_for("productName"),
            brand=evidence_for("brand"),
            barcode=base.product.barcode,
        ),
        serving=ServingInformation(
            size=evidence_for("servingSize"),
            unit=str(serving_unit_value) if serving_unit_value else None,
            household_measure=base.serving.household_measure,
            servings_per_container=evidence_for("servingsPerContainer"),
        ),
        nutrients=nutrients,
        raw_ingredients=raw_ingredients,
        sugar_variants=sugar_variants,
        glycemic=glycemic,
        quality_checks=job.quality_checks,
        validation_checks=validation_checks,
        limitations=list(dict.fromkeys(limitations)),
        diagnostics=diagnostics or build_analysis_diagnostics(job, ocr_result=ocr_result, ocr_llm=ocr_llm, vlm=vlm),
        extraction_candidates=extraction_candidates,
        field_comparisons=field_comparisons,
        retake_recommended=bool(retake_reasons),
        retake_reasons=retake_reasons,
        provenance=Provenance(
            pipeline_version=PIPELINE_VERSION,
            completed_at=datetime.now(timezone.utc),
            external_processors=processors,
        ),
    )


def build_field_comparisons(
    job: AnalysisJob,
    ocr_llm: MethodExtractionOutcome | None,
    vlm: MethodExtractionOutcome | None,
    ocr_result: OcrResult | None,
) -> tuple[dict[str, list[ExtractionCandidate]], dict[str, FieldComparison]]:
    extraction_candidates: dict[str, list[ExtractionCandidate]] = {}
    field_comparisons: dict[str, FieldComparison] = {}
    for spec in FIELD_SPECS:
        ocr_candidate = build_candidate(job, spec, ocr_llm, ocr_result) if ocr_llm else None
        vlm_candidate = build_candidate(job, spec, vlm, ocr_result) if vlm else None
        candidates = [candidate for candidate in (ocr_candidate, vlm_candidate) if candidate is not None]
        if candidates:
            extraction_candidates[spec.field_id] = candidates
        agreement_status, prefilled, warning_reason = compare_candidates(spec, ocr_candidate, vlm_candidate)
        field_comparisons[spec.field_id] = FieldComparison(
            field=spec.field_id,
            agreement_status=agreement_status,
            ocr_candidate=ocr_candidate,
            vlm_candidate=vlm_candidate,
            prefilled=prefilled,
            warning_reason=warning_reason,
        )
    return extraction_candidates, field_comparisons


def build_candidate(
    job: AnalysisJob,
    spec: FieldSpec,
    outcome: MethodExtractionOutcome | None,
    ocr_result: OcrResult | None,
) -> ExtractionCandidate | None:
    if not outcome or not outcome.extraction:
        return None
    label = outcome.extraction.label
    value = getattr(label, spec.label_attr)
    if not _present(value):
        return None
    unit = label.serving_unit if spec.field_id == "servingSize" and label.serving_unit else spec.unit
    warning_reason = _short_reason("; ".join(outcome.validation_failures)) if outcome.validation_failures else None
    return ExtractionCandidate(
        field=spec.field_id,
        source=outcome.source,
        value=value,
        unit=unit,
        confidence=label.confidence,
        snippet=_candidate_snippet(job, spec, outcome, ocr_result),
        warning_reason=warning_reason,
        validation_passed=outcome.validation_passed,
    )


def compare_candidates(
    spec: FieldSpec,
    ocr_candidate: ExtractionCandidate | None,
    vlm_candidate: ExtractionCandidate | None,
) -> tuple[AgreementStatus, bool, str | None]:
    if ocr_candidate and vlm_candidate:
        if ocr_candidate.validation_passed and vlm_candidate.validation_passed and values_agree(
            ocr_candidate.value,
            vlm_candidate.value,
            spec.value_kind,
        ):
            return "agree", True, None
        if not ocr_candidate.validation_passed or not vlm_candidate.validation_passed:
            return "conflict", False, "One or more extraction methods failed deterministic validation."
        return "conflict", False, "OCR+LLM and VLM produced different values for this field."
    if ocr_candidate:
        reason = (
            "Only OCR+LLM produced this candidate; choose it manually if it matches the label."
            if ocr_candidate.validation_passed
            else "OCR+LLM produced this value, but deterministic validation failed."
        )
        return "ocr_only", False, reason
    if vlm_candidate:
        reason = (
            "Only VLM produced this candidate; choose it manually if it matches the label."
            if vlm_candidate.validation_passed
            else "VLM produced this value, but deterministic validation failed."
        )
        return "vlm_only", False, reason
    return "unavailable", False, "No extraction method produced a candidate for this field."


def values_agree(left: Any, right: Any, value_kind: Literal["number", "text"]) -> bool:
    if value_kind == "number":
        left_number = _number(left)
        right_number = _number(right)
        return left_number is not None and right_number is not None and abs(left_number - right_number) <= 0.05
    return normalize_text(left) == normalize_text(right)


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().casefold()


def _present(value: Any) -> bool:
    return value is not None and (not isinstance(value, str) or bool(value.strip()))


def _candidate_snippet(
    job: AnalysisJob,
    spec: FieldSpec,
    outcome: MethodExtractionOutcome,
    ocr_result: OcrResult | None,
) -> str | None:
    if outcome.source == "ocr_llm" and ocr_result:
        panel = _panel_for_spec(job, spec)
        return _ocr_snippet(ocr_result.text_by_panel.get(panel, "")) or _ocr_snippet(ocr_result.combined_text)
    notes = outcome.extraction.label.notes if outcome.extraction else []
    if notes:
        return _ocr_snippet(" ".join(notes))
    return f"Image panels: {', '.join(outcome.image_panels)}" if outcome.image_panels else None


def _panel_for_spec(job: AnalysisJob, spec: FieldSpec) -> str:
    if spec.image_kind in job.image_paths:
        return spec.image_kind
    if spec.field_id in {"productName", "brand"} and "nutrition" in job.image_paths:
        return "nutrition"
    if spec.field_id == "rawIngredients" and "nutrition" in job.image_paths:
        return "nutrition"
    return next(iter(job.image_paths), spec.image_kind)


def _comparison_confidence(comparison: FieldComparison) -> float | None:
    values = [
        candidate.confidence
        for candidate in (comparison.ocr_candidate, comparison.vlm_candidate)
        if candidate and candidate.confidence is not None
    ]
    if not values:
        return None
    return round(min(values), 3)


def _prefilled_candidate(comparison: FieldComparison) -> ExtractionCandidate | None:
    if not comparison.prefilled:
        return None
    return comparison.ocr_candidate or comparison.vlm_candidate


def _prefilled_scalar(comparison: FieldComparison) -> Any | None:
    candidate = _prefilled_candidate(comparison)
    return candidate.value if candidate else None


def method_review_checks(*outcomes: MethodExtractionOutcome | None) -> list[ValidationCheck]:
    checks: list[ValidationCheck] = []
    for outcome in outcomes:
        if not outcome:
            continue
        source_label = "OCR+LLM" if outcome.source == "ocr_llm" else "VLM"
        if outcome.status == "failed" and outcome.failure_reason:
            checks.append(ValidationCheck(
                code=f"{outcome.source}_extraction_issue",
                status="review",
                message=f"{source_label}: {outcome.failure_reason}",
            ))
    return checks


def build_retake_reasons(
    job: AnalysisJob,
    comparisons: dict[str, FieldComparison],
    ocr_llm: MethodExtractionOutcome | None,
    vlm: MethodExtractionOutcome | None,
) -> list[str]:
    reasons: list[str] = []
    if any(check.status == "warn" for check in job.quality_checks):
        reasons.append("Image readability warnings were detected; retake closer or reduce glare if values are hard to verify.")
    conflict_fields = [
        field_id for field_id, comparison in comparisons.items()
        if comparison.agreement_status == "conflict" and field_id in NUTRIENT_FIELD_IDS | {"productName", "servingSize", "rawIngredients"}
    ]
    if conflict_fields:
        reasons.append(f"Extraction methods conflict on {', '.join(_friendly_field_name(field_id) for field_id in conflict_fields[:4])}.")
    missing_required = [
        field_id for field_id in ("totalCarbohydrate", "totalSugars")
        if comparisons.get(field_id) and comparisons[field_id].agreement_status == "unavailable"
    ]
    if missing_required:
        reasons.append(f"Required nutrition rows are missing: {', '.join(_friendly_field_name(field_id) for field_id in missing_required)}.")
    method_failures = [
        "OCR+LLM" if outcome.source == "ocr_llm" else "VLM"
        for outcome in (ocr_llm, vlm)
        if outcome and outcome.status == "failed" and outcome.failure_reason
    ]
    if method_failures:
        reasons.append(f"{' and '.join(method_failures)} could not produce accepted label evidence.")
    return list(dict.fromkeys(reasons))


def _friendly_field_name(field_id: str) -> str:
    names = {
        "productName": "product name",
        "servingSize": "serving size",
        "totalCarbohydrate": "total carbohydrate",
        "totalSugars": "total sugars",
        "rawIngredients": "ingredients",
    }
    return names.get(field_id, re.sub(r"(?<!^)([A-Z])", r" \1", field_id).casefold())


def extraction_stage_label(mode: ExtractionMode) -> str:
    if mode == "both":
        return "Running OCR+LLM and VLM extraction"
    if mode == "ocr_llm":
        return "Running OCR+LLM extraction"
    return "Running VLM extraction"


def first_extracted_ingredient_text(*outcomes: MethodExtractionOutcome | None) -> str | None:
    for outcome in outcomes:
        text = outcome.extraction.label.raw_ingredients if outcome and outcome.extraction else None
        if text and text.strip():
            return text
    return None


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

        ocr_llm_outcome: MethodExtractionOutcome | None = None
        vlm_outcome: MethodExtractionOutcome | None = None
        ocr_result: OcrResult | None = None
        diagnostics: AnalysisDiagnostics | None = None
        await job.publish({
            "type": "stage",
            "stage": "label_extraction",
            "status": "running",
            "label": extraction_stage_label(job.extraction_mode),
        })

        if job.extraction_mode == "both":
            ocr_task = asyncio.create_task(run_ocr_llm_method(job))
            vlm_task = asyncio.create_task(run_vlm_method(job))
            (ocr_llm_outcome, ocr_result), vlm_outcome = await asyncio.gather(ocr_task, vlm_task)
        elif job.extraction_mode == "ocr_llm":
            ocr_llm_outcome, ocr_result = await run_ocr_llm_method(job)
            vlm_outcome = MethodExtractionOutcome(
                source="vlm",
                status="skipped",
                failure_reason="VLM extraction was not selected for this scan.",
                image_panels=[panel for panel in ("nutrition", "ingredients", "front") if panel in job.image_paths],
            )
        else:
            vlm_outcome = await run_vlm_method(job)
            ocr_llm_outcome = MethodExtractionOutcome(
                source="ocr_llm",
                status="skipped",
                failure_reason="OCR+LLM extraction was not selected for this scan.",
                image_panels=list(job.image_paths.keys()),
            )

        if ocr_result:
            processors.append("Tesseract OCR" if ocr_result.provider == "tesseract" else "PaddleOCR")
            emit_telemetry(
                "ocr_complete",
                analysis_id=job.analysis_id,
                provider=ocr_result.provider,
                latency_ms=ocr_result.latency_ms,
                panel_count=len(ocr_result.text_by_panel),
                readable_characters=len(ocr_result.combined_text),
            )

        for outcome in (ocr_llm_outcome, vlm_outcome):
            if not outcome or not outcome.extraction:
                continue
            source_label = "ocr_llm" if outcome.source == "ocr_llm" else "vlm"
            processors.append(f"Ollama {outcome.extraction.model}")
            emit_telemetry(
                f"{source_label}_extraction_complete" if outcome.status == "complete" else f"{source_label}_extraction_rejected",
                analysis_id=job.analysis_id,
                model=outcome.extraction.model,
                attempts=outcome.extraction.attempts,
                latency_ms=outcome.extraction.latency_ms,
                prompt_eval_count=outcome.extraction.token_counts.get("prompt_eval_count"),
                eval_count=outcome.extraction.token_counts.get("eval_count"),
                json_validation_failures=len(outcome.extraction.validation_failures),
                deterministic_validation_failures=len(outcome.validation_failures),
            )

        for outcome in (ocr_llm_outcome, vlm_outcome):
            if outcome and outcome.status == "failed":
                fallback_reason = outcome.failure_reason or "Extraction failed."
                source_label = "OCR+LLM" if outcome.source == "ocr_llm" else "VLM"
                emit_telemetry(
                    "label_extraction_fallback",
                    analysis_id=job.analysis_id,
                    ocr_provider=os.getenv("SUGAR_PAI_OCR_PROVIDER", "tesseract"),
                    model=(
                        os.getenv("SUGAR_PAI_EXTRACTION_MODEL", DEFAULT_EXTRACTION_MODEL)
                        if outcome.source == "ocr_llm"
                        else os.getenv("SUGAR_PAI_VISION_MODEL", DEFAULT_VISION_MODEL)
                    ),
                    method=outcome.source,
                    fallback_reason=fallback_reason[:250],
                )
                await job.publish({
                    "type": "stage",
                    "stage": "label_extraction",
                    "status": "running",
                    "label": f"{source_label} needs review: {fallback_reason[:96]}",
                })

        diagnostics = build_analysis_diagnostics(
            job,
            ocr_result=ocr_result,
            ocr_llm=ocr_llm_outcome,
            vlm=vlm_outcome,
        )
        extraction_status = diagnostics.extraction_status
        if extraction_status in {"complete", "partial"}:
            label = "Extraction candidates ready for side-by-side review"
        elif extraction_status == "failed":
            label = "No extraction method produced accepted label evidence"
        else:
            label = "Extraction skipped by selected mode"
        await job.publish({
            "type": "stage",
            "stage": "label_extraction",
            "status": extraction_status if extraction_status != "partial" else "complete",
            "label": label,
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
            ingredient_text = first_extracted_ingredient_text(ocr_llm_outcome, vlm_outcome)
            if ingredient_text:
                variant_count = len(classify_ingredients(ingredient_text))
                await job.publish({
                    "type": "stage",
                    "stage": "ingredient_classification",
                    "status": "complete",
                    "label": f"Matched {variant_count} sugar-related ingredient aliases from candidate text",
                })
            else:
                await job.publish({
                    "type": "stage",
                    "stage": "ingredient_classification",
                    "status": "skipped",
                    "label": "Readable ingredient text unavailable; user transcription required",
                })

        await job.publish({"type": "stage", "stage": "evidence_comparison", "status": "running", "label": "Comparing OCR+LLM and VLM candidates"})
        result = result_from_extraction_comparison(
            job,
            ocr_llm_outcome,
            vlm_outcome,
            ocr_result,
            product,
            source_url,
            processors,
            diagnostics,
        )
        conflict_count = sum(1 for comparison in result.field_comparisons.values() if comparison.agreement_status == "conflict")
        prefilled_count = sum(1 for comparison in result.field_comparisons.values() if comparison.prefilled)
        await job.publish({
            "type": "stage",
            "stage": "evidence_comparison",
            "status": "complete",
            "label": f"Prefilled {prefilled_count} agreeing fields; {conflict_count} conflicts kept blank",
        })

        await job.publish({"type": "stage", "stage": "safety_validation", "status": "running", "label": "Checking units, evidence, and prohibited claims"})
        await asyncio.sleep(0.04)
        job.result = result
        emit_telemetry(
            "analysis_complete",
            analysis_id=job.analysis_id,
            status=result.status,
            ocr_provider=ocr_result.provider if ocr_result else os.getenv("SUGAR_PAI_OCR_PROVIDER", "tesseract"),
            extraction_mode=job.extraction_mode,
            ocr_model=ocr_llm_outcome.extraction.model if ocr_llm_outcome and ocr_llm_outcome.extraction else None,
            vlm_model=vlm_outcome.extraction.model if vlm_outcome and vlm_outcome.extraction else None,
            fallback_reason=diagnostics.fallback_reason[:250] if diagnostics and diagnostics.fallback_reason else None,
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

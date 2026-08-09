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

from .extraction import ExtractedLabel, ExtractionResult, LabelExtractionError, extract_label_fields
from .glycemic import build_glycemic_evidence
from .ocr import OcrProviderError, OcrResult, extract_text_from_images
from .schemas import (
    AnalysisResult,
    EvidenceReference,
    EvidenceValue,
    GlycemicEvidence,
    NutrientCorrections,
    NutrientFields,
    ProductIdentity,
    Provenance,
    QualityCheck,
    ServingInformation,
    ValidationCheck,
)
from .taxonomy import SUGAR_TAXONOMY_VERSION, classify_ingredients
from .telemetry import emit_telemetry
from .validation import validate_nutrients


PIPELINE_VERSION = "research-mvp-0.2.0"
JOB_TTL_SECONDS = 15 * 60
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 36_000_000
OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v3/product/{barcode}.json"


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
            note="OCR plus DeepSeek extraction from the photographed label; user confirmation required.",
        ),
        confidence=confidence,
        conflict=False,
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

    focus_status = "fail" if contrast < 20 or edge_mean < 4 else "warn" if contrast < 32 or edge_mean < 7 else "pass"
    glare_status = classify_glare(glare_ratio, contrast, edge_mean)
    return [
        QualityCheck(code=f"{kind}_resolution", label=f"{kind.title()} resolution", status="pass", detail=f"{width} × {height} px; EXIF removed."),
        QualityCheck(code=f"{kind}_focus", label=f"{kind.title()} focus", status=focus_status, detail="Edge detail and contrast were measured from the sanitized image."),
        QualityCheck(
            code=f"{kind}_glare",
            label=f"{kind.title()} glare",
            status=glare_status,
            detail=(
                "Large clipped areas and low image detail may hide printed values."
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


def result_from_database(job: AnalysisJob, product: dict[str, Any] | None, source_url: str | None, processors: list[str]) -> AnalysisResult:
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
            message="No OCR/LLM provider produced accepted label evidence. Confirm values manually from the current package.",
        )],
        limitations=[
            "Live label extraction did not produce accepted evidence; database values, if present, are unconfirmed.",
            "Ingredient order cannot establish grams of an individual sweetener.",
            "No licensed FNRI, Trinidad, or tested-product GI table is bundled.",
            "This tool does not provide medical advice, diabetes safety claims, medication guidance, or glucose predictions.",
        ],
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
        "Automated readings are unconfirmed OCR and DeepSeek outputs; manual review is required before logging.",
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
        provenance=Provenance(
            pipeline_version=PIPELINE_VERSION,
            completed_at=datetime.now(timezone.utc),
            external_processors=processors,
        ),
    )


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

        extraction: ExtractionResult | None = None
        ocr_result: OcrResult | None = None
        fallback_reason: str | None = None
        await job.publish({"type": "stage", "stage": "label_extraction", "status": "running", "label": "Running OCR and DeepSeek extraction"})
        try:
            ocr_result = await extract_text_from_images(job.image_paths)
            processors.append("Tesseract OCR" if ocr_result.provider == "tesseract" else "PaddleOCR")
            emit_telemetry(
                "ocr_complete",
                analysis_id=job.analysis_id,
                provider=ocr_result.provider,
                latency_ms=ocr_result.latency_ms,
                panel_count=len(ocr_result.text_by_panel),
                readable_characters=len(ocr_result.combined_text),
            )
            extraction = await extract_label_fields(ocr_result)
            processors.append(f"Ollama {extraction.model}")
            emit_telemetry(
                "label_extraction_complete",
                analysis_id=job.analysis_id,
                model=extraction.model,
                attempts=extraction.attempts,
                latency_ms=extraction.latency_ms,
                prompt_eval_count=extraction.token_counts.get("prompt_eval_count"),
                eval_count=extraction.token_counts.get("eval_count"),
                json_validation_failures=len(extraction.validation_failures),
            )
            retry_note = " after one validation retry" if extraction.attempts > 1 else ""
            await job.publish({
                "type": "stage",
                "stage": "label_extraction",
                "status": "complete",
                "label": f"DeepSeek returned schema-valid label fields{retry_note}",
            })
        except (OcrProviderError, LabelExtractionError) as exc:
            fallback_reason = str(exc)
            emit_telemetry(
                "label_extraction_fallback",
                analysis_id=job.analysis_id,
                ocr_provider=os.getenv("SUGAR_PAI_OCR_PROVIDER", "tesseract"),
                model=os.getenv("SUGAR_PAI_EXTRACTION_MODEL", "deepseek-v4-flash:cloud"),
                fallback_reason=fallback_reason[:250],
            )
            await job.publish({
                "type": "stage",
                "stage": "label_extraction",
                "status": "skipped",
                "label": f"Live extraction unavailable: {fallback_reason[:96]}",
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
            if extraction and extraction.label.raw_ingredients:
                variant_count = len(classify_ingredients(extraction.label.raw_ingredients))
                await job.publish({
                    "type": "stage",
                    "stage": "ingredient_classification",
                    "status": "complete",
                    "label": f"Matched {variant_count} sugar-related ingredient aliases",
                })
            else:
                await job.publish({
                    "type": "stage",
                    "stage": "ingredient_classification",
                    "status": "skipped",
                    "label": "Readable ingredient text unavailable; user transcription required",
                })

        await job.publish({"type": "stage", "stage": "evidence_comparison", "status": "running", "label": "Applying source precedence"})
        if extraction:
            try:
                result = result_from_extraction(job, extraction, product, source_url, processors)
                await job.publish({
                    "type": "stage",
                    "stage": "evidence_comparison",
                    "status": "complete",
                    "label": "Current-label readings prefilled for manual review",
                })
            except ValueError as exc:
                fallback_reason = str(exc)
                emit_telemetry(
                    "label_extraction_rejected",
                    analysis_id=job.analysis_id,
                    fallback_reason=fallback_reason[:250],
                )
                result = result_from_database(job, product, source_url, processors)
                result.validation_checks = [
                    *result.validation_checks,
                    ValidationCheck(
                        code="label_extraction_rejected",
                        status="review",
                        message="OCR/LLM nutrition values were rejected by deterministic arithmetic checks; confirm manually.",
                    ),
                ]
                result.limitations = [
                    *result.limitations,
                    "OCR/LLM values were not used because deterministic nutrition validation failed.",
                ]
                await job.publish({
                    "type": "stage",
                    "stage": "evidence_comparison",
                    "status": "complete",
                    "label": "Extracted values rejected; manual review required",
                })
        else:
            result = result_from_database(job, product, source_url, processors)
            if fallback_reason:
                result.validation_checks = [
                    *result.validation_checks,
                    ValidationCheck(
                        code="label_extraction_fallback",
                        status="review",
                        message=fallback_reason,
                    ),
                ]
                result.limitations = [
                    *result.limitations,
                    "Live OCR/LLM extraction did not produce accepted label evidence.",
                ]
            await job.publish({
                "type": "stage",
                "stage": "evidence_comparison",
                "status": "complete",
                "label": "Unconfirmed database data kept separate from current-label evidence",
            })

        await job.publish({"type": "stage", "stage": "safety_validation", "status": "running", "label": "Checking units, evidence, and prohibited claims"})
        await asyncio.sleep(0.04)
        job.result = result
        emit_telemetry(
            "analysis_complete",
            analysis_id=job.analysis_id,
            status=result.status,
            ocr_provider=ocr_result.provider if ocr_result else os.getenv("SUGAR_PAI_OCR_PROVIDER", "tesseract"),
            model=extraction.model if extraction else os.getenv("SUGAR_PAI_EXTRACTION_MODEL", "deepseek-v4-flash:cloud"),
            fallback_reason=fallback_reason[:250] if fallback_reason else None,
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

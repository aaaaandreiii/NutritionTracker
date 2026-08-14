from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .meal_image import MealImageError, confidence_band, extract_meal_components_from_image
from .schemas import (
    ConfirmedMealComponentRequest,
    EstimatedMealComponentDraft,
    EstimatedMealComponentRecord,
    EstimatedMealDraft,
    EstimatedMealRecord,
    EstimatedNutrientRanges,
    EvidenceTrailItem,
    FinalizeEstimatedMealRequest,
    NumericRange,
    Provenance,
)
from .telemetry import emit_telemetry
from .unlabeled_foods import CATALOG, best_alias_match, normalize
from .usda import (
    NUTRIENT_KEYS,
    UsdaRequestError,
    UsdaUnavailableError,
    calculate_nutrient_ranges,
    get_food_data_details,
    search_food_data,
)


ESTIMATED_MEAL_PIPELINE_VERSION = "estimated-unlabeled-meal-v1"
ESTIMATED_MEAL_LIMITATIONS = [
    "Nutrition is estimated from user-confirmed portion ranges and USDA per-100-g data; it is not a laboratory analysis of this meal.",
    "Ranges represent portion uncertainty only, not recipe, laboratory, or population variance.",
    "Aggregate ranges include matched components only and identify every excluded or nutrient-unknown component.",
    "Estimated meals do not receive numeric GI, GL, diabetes suitability claims, medication guidance, or glucose predictions.",
]


@dataclass
class EstimatedMealJob:
    analysis_id: str
    temp_dir: Path
    image_path: Path | None
    description: str | None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    events: list[dict[str, Any]] = field(default_factory=list)
    result: EstimatedMealDraft | None = None
    done: bool = False
    changed: asyncio.Condition = field(default_factory=asyncio.Condition)

    async def publish(self, event: dict[str, Any]) -> None:
        async with self.changed:
            self.events.append(event)
            self.changed.notify_all()


async def run_estimated_meal_pipeline(job: EstimatedMealJob) -> None:
    started = time.perf_counter()
    external_processors: list[str] = []
    warnings: list[str] = []
    try:
        await job.publish(_stage("image_check", "complete" if job.image_path else "skipped", "Food photo checked" if job.image_path else "Manual food description received"))
        await job.publish(_stage("component_identification", "running", "Identifying visible food components"))

        raw_components: list[dict[str, Any]] = []
        if job.image_path:
            stage_started = time.perf_counter()
            try:
                extraction = await extract_meal_components_from_image(job.image_path)
                external_processors.append(f"Ollama {extraction.model}")
                raw_components = [
                    {
                        "name": item.food_name,
                        "clues": item.preparation_clues,
                        "portion": item.household_portion,
                        "range": NumericRange(minimum=item.gram_min, maximum=item.gram_max),
                        "confidence": item.confidence,
                        "source_path": "vlm",
                    }
                    for item in extraction.meal.components[:12]
                ]
                emit_telemetry(
                    "estimated_meal_stage",
                    stage="component_identification",
                    latency_ms=round((time.perf_counter() - stage_started) * 1000),
                    source_path="vlm",
                    component_count=len(raw_components),
                )
            except MealImageError as exc:
                warnings.append(f"Vision identification was unavailable: {exc} Add foods manually or use the curated catalog.")
                emit_telemetry("estimated_meal_fallback", stage="component_identification", fallback_reason=str(exc)[:250])
        elif job.description:
            raw_components = [{
                "name": job.description,
                "clues": [],
                "portion": "user-described portion",
                "range": NumericRange(minimum=50, maximum=150),
                "confidence": 1.0,
                "source_path": "manual",
            }]

        await job.publish(_stage(
            "component_identification",
            "complete" if raw_components else "failed",
            f"Identified {len(raw_components)} component{'s' if len(raw_components) != 1 else ''}" if raw_components else "Add foods manually or choose from the curated catalog",
        ))
        await job.publish(_stage("nutrition_matching", "running", "Searching USDA FoodData Central"))

        components: list[EstimatedMealComponentDraft] = []
        for item in raw_components[:12]:
            search_warning: str | None = None
            try:
                search = await search_food_data(item["name"], limit=5)
                candidates = search.candidates
                search_warning = search.warning
                if candidates and "USDA FoodData Central" not in external_processors:
                    external_processors.append("USDA FoodData Central")
            except UsdaRequestError as exc:
                candidates = []
                search_warning = str(exc)

            catalog_food = _catalog_match(item["name"])
            tags = list(catalog_food.qualitative_tags) if catalog_food else []
            context_only = not candidates
            if search_warning and search_warning not in warnings:
                warnings.append(search_warning)
            components.append(EstimatedMealComponentDraft(
                component_id=str(uuid.uuid4()),
                identified_name=item["name"],
                preparation_clues=item["clues"],
                household_portion=item["portion"],
                gram_range=item["range"],
                confidence=item["confidence"],
                confidence_band=confidence_band(item["confidence"]),
                candidates=candidates[:5],
                selected_fdc_id=candidates[0].fdc_id if candidates else None,
                context_only=context_only,
                qualitative_tags=tags,
                source_path="curated" if context_only and catalog_food else item["source_path"],
            ))

        await job.publish(_stage(
            "nutrition_matching",
            "complete" if any(component.candidates for component in components) else "skipped",
            "USDA candidates ready for confirmation" if any(component.candidates for component in components) else "USDA matches unavailable; qualitative context remains available",
        ))
        draft = EstimatedMealDraft(
            analysis_id=job.analysis_id,
            components=components,
            warnings=warnings,
            limitations=ESTIMATED_MEAL_LIMITATIONS,
            provenance=Provenance(
                pipeline_version=ESTIMATED_MEAL_PIPELINE_VERSION,
                completed_at=datetime.now(timezone.utc),
                external_processors=external_processors,
            ),
        )
        job.result = draft
        await job.publish({"type": "result", "result": draft.model_dump(mode="json", by_alias=True)})
        emit_telemetry(
            "estimated_meal_analysis",
            latency_ms=round((time.perf_counter() - started) * 1000),
            source_path="vlm" if job.image_path and raw_components else "manual_or_fallback",
            component_count=len(components),
            fallback_reason="; ".join(warnings)[:250] if warnings else None,
        )
    except Exception as exc:  # pragma: no cover - final safety net for the SSE job.
        await job.publish({"type": "error", "message": "Estimated meal analysis failed. Add foods manually or use the curated fallback."})
        emit_telemetry("estimated_meal_error", fallback_reason=str(exc)[:250])
    finally:
        job.done = True
        async with job.changed:
            job.changed.notify_all()


async def finalize_estimated_meal(
    job: EstimatedMealJob,
    request: FinalizeEstimatedMealRequest,
) -> EstimatedMealRecord:
    draft_by_id = {component.component_id: component for component in (job.result.components if job.result else [])}
    seen: set[str] = set()
    component_records: list[EstimatedMealComponentRecord] = []
    external_processors = list(job.result.provenance.external_processors if job.result else [])
    now = datetime.now(timezone.utc)

    for component in request.components:
        if component.component_id in seen:
            raise ValueError("Each meal component must be confirmed once.")
        seen.add(component.component_id)
        draft = draft_by_id.get(component.component_id)
        confidence = draft.confidence if draft else None
        band = draft.confidence_band if draft else "unknown"
        trail = [EvidenceTrailItem(
            timestamp=now,
            evidence_type="observed",
            source_kind="user",
            source_id="user-confirmation",
            note=f"User confirmed identity and {component.gram_range.minimum:g}–{component.gram_range.maximum:g} g portion range.",
        )]
        if draft and draft.source_path == "vlm":
            trail.insert(0, EvidenceTrailItem(
                timestamp=job.result.provenance.completed_at if job.result else now,
                evidence_type="estimated",
                source_kind="calculated",
                source_id="ollama-meal-vision",
                note="Vision model proposed food identity, preparation clues, and a portion range; it provided no nutrients.",
            ))

        if component.context_only:
            component_records.append(EstimatedMealComponentRecord(
                component_id=component.component_id,
                confirmed_name=component.confirmed_name,
                household_portion=component.household_portion,
                gram_range=component.gram_range,
                context_only=True,
                confidence=confidence,
                confidence_band=band,
                nutrient_ranges=EstimatedNutrientRanges(),
                qualitative_tags=component.qualitative_tags or (draft.qualitative_tags if draft else []),
                evidence_trail=trail,
                limitations=["No credible USDA match was confirmed; this component is context-only and excluded from every aggregate range."],
            ))
            continue

        try:
            match = await get_food_data_details(component.fdc_id or 0)
        except (UsdaUnavailableError, UsdaRequestError) as exc:
            raise ValueError(str(exc)) from exc
        if "USDA FoodData Central" not in external_processors:
            external_processors.append("USDA FoodData Central")
        calculated = calculate_nutrient_ranges(match.nutrients_per_100g, component.gram_range)
        trail.extend([
            EvidenceTrailItem(
                timestamp=match.source.retrieved_at or now,
                evidence_type="retrieved",
                source_kind="database",
                source_id=match.source.source_id,
                note="Retrieved per-100-g nutrient values from USDA FoodData Central.",
            ),
            EvidenceTrailItem(
                timestamp=now,
                evidence_type="derived",
                source_kind="calculated",
                source_id="portion-range-calculation-v1",
                note="Multiplied each available USDA per-100-g value by the confirmed gram endpoints.",
            ),
        ])
        missing = [key for key, value in calculated.items() if value is None]
        component_records.append(EstimatedMealComponentRecord(
            component_id=component.component_id,
            confirmed_name=component.confirmed_name,
            household_portion=component.household_portion,
            gram_range=component.gram_range,
            context_only=False,
            confidence=confidence,
            confidence_band=band,
            usda_match=match,
            nutrient_ranges=EstimatedNutrientRanges(**calculated),
            qualitative_tags=component.qualitative_tags or (draft.qualitative_tags if draft else []),
            evidence_trail=trail,
            limitations=[f"USDA did not provide {key.replace('_', ' ')} for this match." for key in missing],
        ))

    matched = [component for component in component_records if not component.context_only]
    excluded = len(component_records) - len(matched)
    aggregates: dict[str, NumericRange | None] = {}
    unknown_counts: dict[str, int] = {}
    for key in NUTRIENT_KEYS:
        ranges = [getattr(component.nutrient_ranges, key) for component in matched]
        known = [value for value in ranges if value is not None]
        unknown_counts[key] = len(ranges) - len(known)
        aggregates[key] = NumericRange(
            minimum=round(sum(value.minimum for value in known), 2),
            maximum=round(sum(value.maximum for value in known), 2),
        ) if known else None

    partial = excluded > 0 or not matched or any(unknown_counts.values())
    limitations = list(ESTIMATED_MEAL_LIMITATIONS)
    if excluded:
        limitations.append(
            f"Partial meal estimate: {excluded} of {len(component_records)} confirmed component{'s were' if excluded != 1 else ' was'} context-only and excluded from aggregate ranges."
        )
    if any(unknown_counts.values()):
        limitations.append("Some matched USDA records omit nutrients; displayed aggregates are known-component subtotals for those nutrients.")

    return EstimatedMealRecord(
        record_id=str(uuid.uuid4()),
        analysis_id=job.analysis_id,
        meal_name=request.meal_name,
        meal=request.meal,
        components=component_records,
        aggregate_nutrient_ranges=EstimatedNutrientRanges(**aggregates),
        matched_component_count=len(matched),
        excluded_component_count=excluded,
        unknown_nutrient_counts=unknown_counts,
        partial=partial,
        limitations=limitations,
        provenance=Provenance(
            pipeline_version=ESTIMATED_MEAL_PIPELINE_VERSION,
            completed_at=now,
            external_processors=external_processors,
        ),
    )


def _catalog_match(name: str):
    normalized = normalize(name)
    if not normalized:
        return None
    for food in CATALOG:
        if best_alias_match(normalized, food.aliases):
            return food
    return None


def _stage(stage: str, status: str, label: str) -> dict[str, str]:
    return {"type": "stage", "stage": stage, "status": status, "label": label}

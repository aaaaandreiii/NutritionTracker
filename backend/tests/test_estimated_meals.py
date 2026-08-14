import asyncio
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from app.estimated_meals import EstimatedMealJob, finalize_estimated_meal
from app.schemas import (
    EstimatedMealComponentDraft,
    EstimatedMealDraft,
    FinalizeEstimatedMealRequest,
    FoodDataCandidate,
    NumericRange,
    Provenance,
    SourceMetadata,
    UsdaNutrientProfile,
)


def draft_job():
    directory = Path(tempfile.mkdtemp())
    job = EstimatedMealJob(analysis_id="meal-test", temp_dir=directory, image_path=None, description="rice")
    job.done = True
    job.result = EstimatedMealDraft(
        analysis_id=job.analysis_id,
        components=[EstimatedMealComponentDraft(
            component_id="rice",
            identified_name="white rice",
            household_portion="one cup",
            gram_range=NumericRange(minimum=120, maximum=180),
            confidence=0.8,
            confidence_band="high",
            candidates=[],
            context_only=False,
            source_path="vlm",
        )],
        provenance=Provenance(pipeline_version="test", completed_at=datetime.now(timezone.utc), external_processors=[]),
    )
    return job


def usda_match():
    return FoodDataCandidate(
        fdc_id=123,
        description="Rice, white, cooked",
        data_type="Foundation",
        nutrients_per_100g=UsdaNutrientProfile(total_carbohydrate=28, protein=2.7, fat=0.3),
        source=SourceMetadata(source_id="usda-fdc-123", name="USDA FoodData Central"),
    )


def test_finalize_calculates_ranges_and_preserves_source_trail(monkeypatch):
    async def details(_fdc_id):
        return usda_match()

    monkeypatch.setattr("app.estimated_meals.get_food_data_details", details)
    record = asyncio.run(finalize_estimated_meal(draft_job(), FinalizeEstimatedMealRequest.model_validate({
        "mealName": "Rice meal", "meal": "Lunch", "components": [{
            "componentId": "rice", "confirmedName": "white rice", "fdcId": 123,
            "householdPortion": "one cup", "gramRange": {"minimum": 120, "maximum": 180, "unit": "g"},
        }],
    })))

    assert record.aggregate_nutrient_ranges.total_carbohydrate.minimum == 33.6
    assert record.aggregate_nutrient_ranges.total_carbohydrate.maximum == 50.4
    assert record.unknown_nutrient_counts["total_sugars"] == 1
    assert {item.evidence_type for item in record.components[0].evidence_trail} == {"estimated", "observed", "retrieved", "derived"}
    assert record.partial is True


def test_context_only_component_is_excluded_and_partial():
    job = draft_job()
    record = asyncio.run(finalize_estimated_meal(job, FinalizeEstimatedMealRequest.model_validate({
        "mealName": "Unknown dish", "components": [{
            "componentId": "rice", "confirmedName": "unknown sauce", "fdcId": None,
            "householdPortion": "one spoon", "gramRange": {"minimum": 10, "maximum": 20, "unit": "g"},
            "contextOnly": True,
        }],
    })))

    assert record.matched_component_count == 0
    assert record.excluded_component_count == 1
    assert record.aggregate_nutrient_ranges.total_carbohydrate is None
    assert "excluded" in record.limitations[-1]

import pytest
from pydantic import ValidationError

from app.meal_image import DetectedMeal, MEAL_IMAGE_PROMPT


def component(index: int = 0):
    return {
        "food_name": f"food {index}",
        "preparation_clues": ["grilled"],
        "household_portion": "one piece",
        "gram_min": 50,
        "gram_max": 90,
        "confidence": 0.8,
    }


def test_meal_image_schema_rejects_macros_and_invalid_ranges():
    with pytest.raises(ValidationError):
        DetectedMeal.model_validate({"components": [{**component(), "carbohydrate": 20}]})
    with pytest.raises(ValidationError):
        DetectedMeal.model_validate({"components": [{**component(), "gram_min": 100, "gram_max": 20}]})


def test_meal_image_schema_limits_components_and_prompt_prohibits_nutrients():
    with pytest.raises(ValidationError):
        DetectedMeal.model_validate({"components": [component(index) for index in range(13)]})
    assert "NEVER return calories" in MEAL_IMAGE_PROMPT
    assert "glucose predictions" in MEAL_IMAGE_PROMPT

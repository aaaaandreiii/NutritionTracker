from __future__ import annotations

from .schemas import NutrientCorrections, ValidationCheck


PROHIBITED_PHRASES = (
    "diabetes safe",
    "spike hazard",
    "diabetes sugar cap",
    "avoid for type",
    "optimal diabetic",
)


def validate_nutrients(values: NutrientCorrections) -> list[ValidationCheck]:
    checks: list[ValidationCheck] = []
    carbohydrate = values.total_carbohydrate
    sugars = values.total_sugars
    added = values.added_sugars
    fiber = values.fiber

    if carbohydrate is not None and sugars is not None and sugars > carbohydrate + 0.2:
        checks.append(ValidationCheck(
            code="sugars_within_carbohydrate",
            status="fail",
            message="Total sugars cannot exceed total carbohydrate on the same serving basis.",
        ))
    else:
        checks.append(ValidationCheck(
            code="sugars_within_carbohydrate",
            status="pass" if carbohydrate is not None and sugars is not None else "review",
            message="Sugar/carbohydrate arithmetic is consistent." if carbohydrate is not None and sugars is not None else "Sugar/carbohydrate arithmetic could not be checked because a value is missing.",
        ))

    if sugars is not None and added is not None and added > sugars + 0.2:
        checks.append(ValidationCheck(
            code="added_within_total_sugars",
            status="fail",
            message="Added sugars cannot exceed total sugars on the same serving basis.",
        ))
    else:
        checks.append(ValidationCheck(
            code="added_within_total_sugars",
            status="pass" if sugars is not None and added is not None else "review",
            message="Added/total sugar arithmetic is consistent." if sugars is not None and added is not None else "Added-sugar arithmetic remains unknown because a value is missing.",
        ))

    if carbohydrate is not None and fiber is not None and fiber > carbohydrate + 0.2:
        checks.append(ValidationCheck(
            code="fiber_within_carbohydrate",
            status="review",
            message="Fiber exceeds total carbohydrate. Confirm the country format and serving basis.",
        ))
    else:
        checks.append(ValidationCheck(
            code="fiber_within_carbohydrate",
            status="pass" if carbohydrate is not None and fiber is not None else "review",
            message="Fiber/carbohydrate relationship checked." if carbohydrate is not None and fiber is not None else "Fiber/carbohydrate relationship could not be checked.",
        ))
    return checks


def contains_prohibited_claim(text: str) -> bool:
    normalized = text.casefold()
    return any(phrase in normalized for phrase in PROHIBITED_PHRASES)

from app.schemas import NutrientCorrections
from app.validation import contains_prohibited_claim, validate_nutrients


def test_missing_values_propagate_to_review():
    checks = validate_nutrients(NutrientCorrections(total_carbohydrate=20))
    assert all(check.status != "fail" for check in checks)
    assert any(check.status == "review" for check in checks)


def test_rejects_impossible_added_sugar_arithmetic():
    checks = validate_nutrients(NutrientCorrections(
        total_carbohydrate=20,
        total_sugars=8,
        added_sugars=12,
    ))
    assert any(check.code == "added_within_total_sugars" and check.status == "fail" for check in checks)


def test_prohibited_claims_are_detected():
    assert contains_prohibited_claim("This is DIABETES SAFE")
    assert not contains_prohibited_claim("GI is unavailable from this label")

from app.schemas import NumericRange, UsdaNutrientProfile
from app.usda import calculate_nutrient_ranges, parse_nutrient_profile


def test_usda_nutrient_mapping_preserves_unknowns_and_converts_units():
    profile = parse_nutrient_profile([
        {"nutrientNumber": "1005", "nutrientName": "Carbohydrate, by difference", "unitName": "G", "value": 20},
        {"nutrient": {"number": "1003", "name": "Protein", "unitName": "g"}, "amount": 7.5},
        {"nutrientNumber": "1079", "nutrientName": "Fiber, total dietary", "unitName": "mg", "value": 2500},
    ])

    assert profile.total_carbohydrate == 20
    assert profile.protein == 7.5
    assert profile.fiber == 2.5
    assert profile.total_sugars is None


def test_portion_range_uses_per_100g_endpoints_without_inventing_missing_nutrients():
    ranges = calculate_nutrient_ranges(
        UsdaNutrientProfile(total_carbohydrate=30, protein=8),
        NumericRange(minimum=50, maximum=150),
    )

    assert ranges["total_carbohydrate"].minimum == 15
    assert ranges["total_carbohydrate"].maximum == 45
    assert ranges["protein"].minimum == 4
    assert ranges["total_sugars"] is None

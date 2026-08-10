from app.taxonomy import classify_ingredients, sugar_alias_count


def test_classifies_rank_without_attaching_gi_or_grams():
    variants = classify_ingredients("Oats, asukal, glucose syrup, salt")
    assert [(item.canonical_name, item.ingredient_rank) for item in variants] == [
        ("Sucrose", 2),
        ("Glucose syrup", 3),
    ]
    assert all(not hasattr(item, "gi") for item in variants)


def test_prefers_specific_alias_over_generic_sugar():
    variants = classify_ingredients("High fructose corn syrup, cocoa")
    assert len(variants) == 1
    assert variants[0].canonical_name == "High-fructose corn syrup"


def test_taxonomy_has_demo_alias_depth_without_exposing_gi():
    assert sugar_alias_count() >= 60
    variants = classify_ingredients("Coconut sap sugar, maltitol syrup, stevia extract")
    assert [item.canonical_name for item in variants] == [
        "Coconut sugar",
        "Maltitol",
        "Steviol glycosides",
    ]
    assert all(not hasattr(item, "demo_gi") for item in variants)

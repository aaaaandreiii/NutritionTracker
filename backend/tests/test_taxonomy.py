from app.taxonomy import classify_ingredients


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

from app.glycemic import build_glycemic_evidence, calculate_gl, demo_net_carbs, gl_band
from app.schemas import EvidenceValue, NutrientFields
from app.taxonomy import classify_ingredients


def ev(value):
    return EvidenceValue(
        value=value,
        unit="g",
        serving_basis="per labeled serving",
        source_kind="user" if value is not None else "unavailable",
        status="User confirmed" if value is not None else "Unavailable",
        evidence=None,
        confidence=None,
        conflict=False,
        confirmed=value is not None,
    )


def nutrients(carbs, fiber, sugars=0, added=None, alcohols=None):
    return NutrientFields(
        total_carbohydrate=ev(carbs),
        fiber=ev(fiber),
        total_sugars=ev(sugars),
        added_sugars=ev(added),
        sugar_alcohols=ev(alcohols),
        protein=ev(None),
        fat=ev(None),
    )


def test_gl_band_thresholds():
    assert calculate_gl(55, 20) == 11
    assert gl_band(10) == "green"
    assert gl_band(10.1) == "yellow"
    assert gl_band(20) == "red"


def test_demo_net_carbs_requires_carbs_and_fiber_and_does_not_subtract_missing_polyols():
    net, limitations = demo_net_carbs(nutrients(22, 3, alcohols=None))
    assert net == 19
    assert any("none were subtracted" in item for item in limitations)

    missing, missing_limitations = demo_net_carbs(nutrients(22, None, alcohols=4))
    assert missing is None
    assert any("total carbohydrate and dietary fiber" in item for item in missing_limitations)


def test_demo_net_carbs_subtracts_declared_sugar_alcohols():
    net, limitations = demo_net_carbs(nutrients(20, 2, alcohols=8))
    assert net == 10
    assert not any("none were subtracted" in item for item in limitations)


def test_heuristic_demo_glycemic_evidence_is_labeled_and_banded():
    glycemic, limitations = build_glycemic_evidence(
        nutrients(22, 3, sugars=7),
        classify_ingredients("Oats, asukal, salt"),
    )
    assert glycemic.status == "heuristic_demo"
    assert glycemic.match_level == "alias_heuristic"
    assert glycemic.gi == 65
    assert glycemic.available_carbohydrate_grams == 19
    assert glycemic.gl == 12.4
    assert glycemic.gl_band == "yellow"
    assert "not a tested product GI" in glycemic.reason
    assert any("No licensed" in item for item in limitations)


def test_glycemic_unavailable_without_alias():
    glycemic, _limitations = build_glycemic_evidence(
        nutrients(22, 3, sugars=7),
        classify_ingredients("Oats, salt"),
    )
    assert glycemic.status == "unavailable"
    assert glycemic.gl is None

import asyncio

import pytest

from app.schemas import SmartContextCard, SmartContextResolveRequest
from app.smart_context import _validate_generated_cards, clear_smart_context_cache, deterministic_cards, resolve_smart_context


def request_with_ranges(**nutrients):
    empty = {key: {"value": None, "range": None, "evidenceType": "unavailable", "sourceId": None} for key in (
        "totalCarbohydrate", "fiber", "totalSugars", "addedSugars", "sugarAlcohols", "protein", "fat"
    )}
    empty.update(nutrients)
    return SmartContextResolveRequest.model_validate({
        "kind": "estimated_unlabeled_meal",
        "displayName": "Kanin with ulam",
        "market": "PH",
        "meal": "Lunch",
        "nutrients": empty,
        "contextFlags": [],
        "qualitativeTags": ["rice"],
        "limitations": [],
        "excludedComponentCount": 1,
    })


def nutrient_range(minimum, maximum):
    return {"value": None, "range": {"minimum": minimum, "maximum": maximum, "unit": "g"}, "evidenceType": "derived", "sourceId": "usda-fdc"}


def test_estimated_rule_triggers_only_when_entire_range_supports_condition():
    supported, _ = deterministic_cards(request_with_ranges(
        totalCarbohydrate=nutrient_range(20, 35),
        fiber=nutrient_range(0.5, 2.5),
        protein=nutrient_range(1, 4),
        fat=nutrient_range(1, 3),
    ))
    boundary, _ = deterministic_cards(request_with_ranges(
        totalCarbohydrate=nutrient_range(10, 35),
        fiber=nutrient_range(0.5, 2.5),
    ))

    assert "fiber-anchor" in {card.rule_id for card in supported}
    assert "fiber-anchor" not in {card.rule_id for card in boundary}
    assert "uncertainty-boundary" in {card.rule_id for card in boundary}
    fiber_card = next(card for card in supported if card.rule_id == "fiber-anchor")
    protein_fat_card = next(card for card in supported if card.rule_id == "protein-fat-context")
    assert "Ginisang monggo" in fiber_card.actions
    assert not any(rejected in " ".join(fiber_card.actions).casefold() for rejected in ("itlog", "isda", "egg", "fish", "chicken", "drink"))
    assert any(item in " ".join(protein_fat_card.actions).casefold() for item in ("itlog", "tokwa", "chicken", "beans"))


def test_packaged_fiber_unknown_copy_does_not_call_it_low():
    request = SmartContextResolveRequest.model_validate({
        "kind": "packaged_label",
        "displayName": "Crackers",
        "market": "PH",
        "meal": "Snack",
        "nutrients": {
            "totalCarbohydrate": {"value": 18, "range": None, "evidenceType": "observed", "sourceId": "label"},
            "fiber": {"value": None, "range": None, "evidenceType": "unavailable", "sourceId": None},
            "totalSugars": {"value": 2, "range": None, "evidenceType": "observed", "sourceId": "label"},
            "addedSugars": {"value": None, "range": None, "evidenceType": "unavailable", "sourceId": None},
            "sugarAlcohols": {"value": None, "range": None, "evidenceType": "unavailable", "sourceId": None},
            "protein": {"value": 3, "range": None, "evidenceType": "observed", "sourceId": "label"},
            "fat": {"value": 2, "range": None, "evidenceType": "observed", "sourceId": "label"},
        },
        "contextFlags": [],
        "qualitativeTags": [],
        "limitations": [],
        "excludedComponentCount": 0,
    })

    cards, _ = deterministic_cards(request)
    fiber_card = next(card for card in cards if card.rule_id == "fiber-anchor")

    assert "not available" in fiber_card.body
    assert "low or unknown" not in fiber_card.body


def test_smart_context_cache_reports_cache_hit():
    clear_smart_context_cache()
    request = request_with_ranges(totalCarbohydrate=nutrient_range(5, 8))
    first = asyncio.run(resolve_smart_context(request))
    second = asyncio.run(resolve_smart_context(request))

    assert first.provenance.cache_hit is False
    assert second.provenance.cache_hit is True


def test_writer_validation_rejects_invented_numbers_actions_sources_and_claims():
    allowed = [SmartContextCard(id="one", rule_id="one", title="Context", body="Known range 10–12 g.", evidence_labels=["10–12 g"], actions=["Review"], source_ids=[])]
    invented = [allowed[0].model_copy(update={"body": "This has 99 g and will lower your blood glucose."})]
    changed_action = [allowed[0].model_copy(update={"actions": ["Take medication"]})]
    prohibited = [allowed[0].model_copy(update={"body": "This is safe for people with diabetes."})]

    with pytest.raises(ValueError):
        _validate_generated_cards(allowed, invented)
    with pytest.raises(ValueError):
        _validate_generated_cards(allowed, changed_action)
    with pytest.raises(ValueError):
        _validate_generated_cards(allowed, prohibited)

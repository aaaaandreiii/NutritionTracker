from __future__ import annotations

import hashlib
import json
import os
import re
import time
from typing import Any

import httpx

from .schemas import (
    NumericRange,
    SmartContextCard,
    SmartContextNutrient,
    SmartContextResolveRequest,
    SmartContextResponse,
    SmartContextSource,
    SmartContextWriterProvenance,
)
from .telemetry import emit_telemetry


RULE_VERSION = "smart-context-rules-ph-v1"
EVIDENCE_VERSION = "smart-context-evidence-v1"
PAIRING_VERSION = "ph-pairings-v1"
WRITER_VERSION = "grounded-writer-v1"
_CACHE_TTL_SECONDS = 30 * 60
_CACHE: dict[str, tuple[float, SmartContextResponse]] = {}

SOURCES = {
    "sydney-gi-overview": SmartContextSource(
        source_id="sydney-gi-overview",
        title="About glycemic index",
        publisher="University of Sydney Glycemic Index Research Service",
        url="https://glycemicindex.com/about-gi/",
        summary="Food form, portion, and mixed-meal context matter; GI is not a personal glucose prediction.",
    ),
    "food-order-diabetes-care-2015": SmartContextSource(
        source_id="food-order-diabetes-care-2015",
        title="Food order and post-meal glucose",
        publisher="Diabetes Care",
        url="https://diabetesjournals.org/care/article/38/7/e98/30914/Food-Order-Has-a-Significant-Impact-on",
        summary="A small crossover study supports food-order context as education, not a guaranteed individual response.",
    ),
}

_CATEGORY_ALIASES = {
    "rice": ("rice", "kanin", "sinangag", "champorado", "suman"),
    "bread": ("bread", "pandesal", "roll", "loaf"),
    "noodles": ("noodle", "pancit", "pansit", "bihon", "canton", "pasta"),
    "sweet_snack": ("turon", "banana cue", "dessert", "cake", "cookie", "sweet"),
    "drink": ("drink", "juice", "soda", "taho", "shake", "coffee", "tea"),
    "mixed_dish": ("adobo", "meal", "dish", "ulam", "bowl", "plate"),
}

_PAIRINGS = {
    "rice": ["Ginisang monggo", "Itlog or isda", "Pinakbet or other gulay"],
    "bread": ["Egg", "Unsweetened peanut butter", "Tomato or cucumber"],
    "noodles": ["Tokwa or chicken", "Extra cabbage and carrots", "Skip a sweet drink"],
    "sweet_snack": ["Plain yogurt", "Nuts or seeds", "Keep the drink unsweetened"],
    "drink": ["Choose water with the meal", "Pair food with a protein source", "Avoid stacking sweet drinks"],
    "mixed_dish": ["Add a vegetable side", "Keep rice as a separate portion", "Note sauce or cooking oil"],
    "other": ["Vegetable side", "Beans, tofu, egg, fish, or chicken", "Unsweetened drink"],
}

_PROHIBITED = re.compile(
    r"\b(?:cures?|treats?|prevents?|reverses?)\s+(?:diabetes|a\s+condition|high\s+(?:blood\s+)?glucose)\b|"
    r"\b(?:safe|suitable|good|bad)\s+for\s+(?:people\s+with\s+)?diabet(?:es|ics)\b|"
    r"\bdiabetes[- ]friendly\b|"
    r"\b(?:stop|start|change|skip|reduce|increase)\s+(?:your\s+)?(?:medication|medicine|insulin)\b|"
    r"\b(?:will|guaranteed to|is going to)\s+(?:lower|raise|stabilize|spike)\s+(?:your\s+)?(?:blood\s+)?glucose\b|"
    r"\byou\s+can\s+(?:safely\s+)?eat\b",
    flags=re.IGNORECASE,
)


async def resolve_smart_context(request: SmartContextResolveRequest) -> SmartContextResponse:
    cache_key = _cache_key(request)
    cached = _fresh(_CACHE.get(cache_key))
    if cached is not None:
        response = cached.model_copy(deep=True)
        response.provenance.cache_hit = True
        emit_telemetry("smart_context_resolve", cache_hit=True, generation_mode=response.generation_mode)
        return response

    started = time.perf_counter()
    cards, warnings = deterministic_cards(request)
    fallback_reason: str | None = None
    mode = "deterministic"
    model: str | None = None

    if _writer_enabled() and cards:
        try:
            generated, model = await _rewrite_cards(request, cards)
            cards = generated
            mode = "generated"
        except Exception as exc:  # Grounded copy is optional; deterministic cards remain valid.
            fallback_reason = str(exc)[:300]
            warnings.append("Grounded writer unavailable; deterministic Smart Context is shown.")

    source_ids = sorted({source_id for card in cards for source_id in card.source_ids})
    response = SmartContextResponse(
        triggered_rule_ids=[card.rule_id for card in cards],
        cards=cards,
        sources=[SOURCES[source_id] for source_id in source_ids if source_id in SOURCES],
        evidence_source_ids=source_ids,
        generation_mode=mode,
        warnings=warnings,
        provenance=SmartContextWriterProvenance(
            rule_version=RULE_VERSION,
            evidence_version=EVIDENCE_VERSION,
            pairing_version=PAIRING_VERSION,
            writer_version=WRITER_VERSION,
            model=model,
            fallback_reason=fallback_reason,
        ),
    )
    _CACHE[cache_key] = (time.monotonic(), response.model_copy(deep=True))
    emit_telemetry(
        "smart_context_resolve",
        latency_ms=round((time.perf_counter() - started) * 1000),
        cache_hit=False,
        generation_mode=mode,
        fallback_reason=fallback_reason,
        rule_count=len(cards),
    )
    return response


def deterministic_cards(request: SmartContextResolveRequest) -> tuple[list[SmartContextCard], list[str]]:
    nutrients = request.nutrients
    cards: list[SmartContextCard] = []
    warnings: list[str] = []
    carb = _bounds(nutrients.total_carbohydrate)
    fiber = _bounds(nutrients.fiber)
    sugars = _bounds(nutrients.total_sugars)
    added = _bounds(nutrients.added_sugars)
    protein = _bounds(nutrients.protein)
    fat = _bounds(nutrients.fat)

    if request.kind == "estimated_unlabeled_meal":
        cards.append(SmartContextCard(
            id="estimated-boundary",
            rule_id="estimated-boundary",
            title="Estimated meal range",
            body=(
                "These numbers use confirmed portion ranges and USDA per-100-g matches. "
                f"They cover matched components only; {request.excluded_component_count} context-only component"
                f"{'s were' if request.excluded_component_count != 1 else ' was'} excluded."
            ),
            evidence_labels=["Estimated · user-confirmed portion", "USDA match · per 100 g"],
            actions=["Review each match", "Keep the range visible", "Treat missing nutrients as unknown"],
        ))

    uncertain = _uncertainty_labels({
        "Carbohydrate": (carb, (15, 20, 30)),
        "Fiber": (fiber, (3,)),
        "Total sugars": (sugars, (10,)),
        "Added sugars": (added, (5,)),
        "Protein": (protein, (7,)),
        "Fat": (fat, (5,)),
    })
    if uncertain:
        cards.append(SmartContextCard(
            id="uncertainty-boundary",
            rule_id="uncertainty-boundary",
            title="Range crosses a context boundary",
            body="Sugar pAI did not trigger the affected nutrient rule because the entire confirmed range does not support it. Refine the portion if a narrower estimate is available.",
            evidence_labels=uncertain,
            actions=["Refine gram range", "Keep uncertainty visible"],
        ))

    if carb is None:
        cards.append(SmartContextCard(
            id="data-carbs-missing",
            rule_id="data-carbs-missing",
            title="Carbohydrate context is limited",
            body="Total carbohydrate is unknown, so higher-carbohydrate rules stay off. Missing data is not treated as zero.",
            evidence_labels=["Total carbohydrate unknown"],
            actions=["Check the source match", "Keep unknown blank"],
            source_ids=["sydney-gi-overview"],
        ))

    high_sugar = _entire_at_least(sugars, 10) or _entire_at_least(added, 5)
    carb_context = _entire_at_least(carb, 15)
    higher_context = _entire_at_least(carb, 30) or high_sugar

    if carb_context and (fiber is None or _entire_below(fiber, 3)):
        cards.append(SmartContextCard(
            id="fiber-anchor",
            rule_id="fiber-anchor",
            title="Add a fiber anchor",
            body="The full carbohydrate range supports meal context, while fiber is low or unknown. Add a clearly separate fiber-rich side so the estimate remains honest.",
            evidence_labels=[_range_label("Carbs", carb), _range_label("Fiber", fiber)],
            actions=_pairings_for(request)[:3],
            source_ids=["sydney-gi-overview"],
        ))

    if _entire_at_least(carb, 20) and (protein is None or _entire_below(protein, 7)) and (fat is None or _entire_below(fat, 5)):
        cards.append(SmartContextCard(
            id="protein-fat-context",
            rule_id="protein-fat-context",
            title="Build the rest of the meal",
            body="Across the confirmed range, the available data is carbohydrate-led and low or unknown in both protein and fat. Use a familiar protein food or fat-containing food as separate meal context.",
            evidence_labels=[_range_label("Carbs", carb), _range_label("Protein", protein), _range_label("Fat", fat)],
            actions=_pairings_for(request)[:3],
        ))

    if high_sugar:
        cards.append(SmartContextCard(
            id="sugar-context",
            rule_id="sugar-context",
            title="Treat it as the sweet part",
            body="The entire confirmed sugar range supports this cue. Avoid stacking the item with another sweet drink or dessert; this is meal context, not a glucose prediction.",
            evidence_labels=[_range_label("Total sugars", sugars), _range_label("Added sugars", added)],
            actions=["Choose an unsweetened drink", "Skip another dessert", _pairings_for(request)[0]],
        ))

    if higher_context:
        cards.append(SmartContextCard(
            id="food-order-higher-carb",
            rule_id="food-order-higher-carb",
            title="Order the meal deliberately",
            body="When this is part of a meal, vegetables, beans, or protein foods can come before the higher-carbohydrate item. Evidence supports this as education, not a guaranteed personal response.",
            evidence_labels=[_range_label("Carbs", carb), request.meal or "Meal not specified"],
            actions=["Gulay first", "Protein food first", "Higher-carb item later"],
            source_ids=["food-order-diabetes-care-2015"],
        ))

    if request.context_flags or request.qualitative_tags:
        labels = [flag.label for flag in request.context_flags[:3]] + request.qualitative_tags[:3]
        cards.append(SmartContextCard(
            id="qualitative-context",
            rule_id="qualitative-context",
            title="Preparation and ingredient context",
            body="These descriptors help explain the food form, but they do not originate nutrient grams or rate the meal.",
            evidence_labels=labels,
            actions=["Check sauce or oil", "Note preparation", "Keep numeric claims separate"],
        ))

    if len(cards) == (1 if request.kind == "estimated_unlabeled_meal" else 0):
        cards.append(SmartContextCard(
            id="steady-context",
            rule_id="steady-context",
            title="No additional nutrient rule",
            body="The complete known values did not support another nutrient rule. Keep the confirmed portion, source match, and any missing fields visible.",
            evidence_labels=[_range_label("Carbs", carb)],
            actions=["Keep portion noted", "Review source match"],
        ))

    return cards, warnings


def clear_smart_context_cache() -> None:
    _CACHE.clear()


def _bounds(value: SmartContextNutrient) -> tuple[float, float] | None:
    if value.range is not None:
        return value.range.minimum, value.range.maximum
    if value.value is not None:
        return value.value, value.value
    return None


def _entire_at_least(bounds: tuple[float, float] | None, threshold: float) -> bool:
    return bounds is not None and bounds[0] >= threshold


def _entire_below(bounds: tuple[float, float] | None, threshold: float) -> bool:
    return bounds is not None and bounds[1] < threshold


def _uncertainty_labels(values: dict[str, tuple[tuple[float, float] | None, tuple[float, ...]]]) -> list[str]:
    labels: list[str] = []
    for label, (bounds, thresholds) in values.items():
        if bounds is None or bounds[0] == bounds[1]:
            continue
        if any(bounds[0] < threshold <= bounds[1] for threshold in thresholds):
            labels.append(_range_label(label, bounds))
    return labels


def _range_label(label: str, bounds: tuple[float, float] | None) -> str:
    if bounds is None:
        return f"{label} unknown"
    if bounds[0] == bounds[1]:
        return f"{label} {bounds[0]:g} g"
    return f"{label} {bounds[0]:g}–{bounds[1]:g} g"


def _pairings_for(request: SmartContextResolveRequest) -> list[str]:
    category = (request.category or "").casefold().strip()
    if category not in _PAIRINGS:
        text = " ".join([request.display_name, *request.qualitative_tags]).casefold()
        category = next((key for key, aliases in _CATEGORY_ALIASES.items() if any(alias in text for alias in aliases)), "other")
    return _PAIRINGS[category]


def _writer_enabled() -> bool:
    return os.getenv("SUGAR_PAI_SMART_CONTEXT_WRITER", "false").casefold() in {"1", "true", "yes", "on"}


async def _rewrite_cards(
    request: SmartContextResolveRequest,
    cards: list[SmartContextCard],
) -> tuple[list[SmartContextCard], str]:
    model = os.getenv("SUGAR_PAI_SMART_CONTEXT_MODEL", os.getenv("SUGAR_PAI_CHAT_MODEL", "gemma4:12b"))
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    timeout = float(os.getenv("SUGAR_PAI_SMART_CONTEXT_TIMEOUT_SECONDS", "30"))
    allowed_payload = {
        "food": request.display_name,
        "market": request.market,
        "cards": [card.model_dump(mode="json", by_alias=True) for card in cards],
        "sources": [source.model_dump(mode="json", by_alias=True) for source in SOURCES.values()],
    }
    prompt = (
        "Rewrite only the supplied Smart Context card titles and bodies into concise English. "
        "Keep every ruleId, evidence label, action, and sourceId unchanged. Do not add numbers, actions, "
        "sources, medical claims, suitability claims, medication advice, GI/GL, or glucose predictions. "
        "Return JSON only as {\"cards\":[...]}. Supplied data:\n" + json.dumps(allowed_payload, separators=(",", ":"))
    )
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
        response = await client.post(
            f"{base_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False, "format": "json", "options": {"temperature": 0}},
        )
        response.raise_for_status()
        content = response.json().get("response")
    payload = json.loads(content)
    generated = [SmartContextCard.model_validate(item) for item in payload.get("cards", [])]
    _validate_generated_cards(cards, generated)
    return generated, model


def _validate_generated_cards(allowed: list[SmartContextCard], generated: list[SmartContextCard]) -> None:
    if len(generated) != len(allowed):
        raise ValueError("Writer changed the number of cards.")
    by_rule = {card.rule_id: card for card in allowed}
    if {card.rule_id for card in generated} != set(by_rule):
        raise ValueError("Writer changed or duplicated rule IDs.")
    for card in generated:
        source = by_rule.get(card.rule_id)
        if source is None:
            raise ValueError("Writer returned an unknown rule ID.")
        if card.id != source.id or card.actions != source.actions or card.source_ids != source.source_ids or card.evidence_labels != source.evidence_labels:
            raise ValueError("Writer changed grounded evidence, actions, or source IDs.")
        if any(source_id not in SOURCES for source_id in card.source_ids):
            raise ValueError("Writer returned an unknown evidence source ID.")
        if _PROHIBITED.search(f"{card.title} {card.body}"):
            raise ValueError("Writer returned a prohibited health or medication claim.")
        allowed_numbers = set(re.findall(r"\d+(?:\.\d+)?", f"{source.title} {source.body} {' '.join(source.evidence_labels)}"))
        generated_numbers = set(re.findall(r"\d+(?:\.\d+)?", f"{card.title} {card.body}"))
        if not generated_numbers.issubset(allowed_numbers):
            raise ValueError("Writer invented a numeric claim.")


def _cache_key(request: SmartContextResolveRequest) -> str:
    normalized = request.model_dump(mode="json", by_alias=True, exclude_none=True)
    payload = json.dumps(
        {
            "request": normalized,
            "versions": [RULE_VERSION, EVIDENCE_VERSION, PAIRING_VERSION, WRITER_VERSION],
            "writerEnabled": _writer_enabled(),
            "writerModel": os.getenv("SUGAR_PAI_SMART_CONTEXT_MODEL", os.getenv("SUGAR_PAI_CHAT_MODEL", "gemma4:12b")),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _fresh(entry: tuple[float, SmartContextResponse] | None) -> SmartContextResponse | None:
    if entry is None or time.monotonic() - entry[0] > _CACHE_TTL_SECONDS:
        return None
    return entry[1]

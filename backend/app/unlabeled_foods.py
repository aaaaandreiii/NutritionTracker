from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from .schemas import (
    CuratedFoodCandidate,
    CuratedFoodRecord,
    GlycemicEvidence,
    Provenance,
    SmartContextFlag,
    UnlabeledFoodCatalogResponse,
    UnlabeledFoodIdentifyResponse,
    UnlabeledFoodRecordRequest,
)


CATALOG_LIMITATIONS = [
    "Curated unlabeled-food mode is a qualitative demo for Filipino foods; it does not provide authoritative calories, macros, GI, GL, or FNRI values.",
    "Food images can suggest catalog candidates only; the user must confirm the food and portion before Smart Context appears.",
    "Recipe, brand, sauce, oil, cooking method, and serving size can materially change nutrition context.",
    "This tool does not provide medical advice, diabetes suitability claims, medication guidance, or glucose predictions.",
]


@dataclass(frozen=True)
class CatalogFood:
    food_id: str
    display_name: str
    aliases: tuple[str, ...]
    portion_labels: tuple[str, ...]
    qualitative_tags: tuple[str, ...]
    limitations: tuple[str, ...] = ()


CATALOG: tuple[CatalogFood, ...] = (
    CatalogFood(
        food_id="ph_kanin_white_rice",
        display_name="Kanin / plain white rice",
        aliases=("kanin", "white rice", "plain rice", "cooked rice", "rice"),
        portion_labels=("1/2 cup", "1 cup", "small bowl", "user-described portion"),
        qualitative_tags=("starchy staple", "portion-sensitive", "recipe varies"),
    ),
    CatalogFood(
        food_id="ph_sinangag",
        display_name="Sinangag / garlic fried rice",
        aliases=("sinangag", "garlic rice", "fried rice", "garlic fried rice"),
        portion_labels=("1/2 cup", "1 cup", "plate serving", "user-described portion"),
        qualitative_tags=("starchy staple", "fried or oil varies", "portion-sensitive"),
    ),
    CatalogFood(
        food_id="ph_pandesal",
        display_name="Pandesal",
        aliases=("pandesal", "pan de sal", "bread roll", "filipino bread"),
        portion_labels=("1 piece", "2 pieces", "user-described portion"),
        qualitative_tags=("bread", "refined-grain context", "portion-sensitive"),
    ),
    CatalogFood(
        food_id="ph_pancit",
        display_name="Pancit",
        aliases=("pancit", "pansit", "bihon", "canton", "noodles"),
        portion_labels=("small plate", "regular plate", "user-described portion"),
        qualitative_tags=("noodle dish", "mixed ingredients", "sauce varies", "recipe varies"),
    ),
    CatalogFood(
        food_id="ph_champorado",
        display_name="Champorado",
        aliases=("champorado", "tsampurado", "chocolate rice porridge"),
        portion_labels=("small bowl", "regular bowl", "user-described portion"),
        qualitative_tags=("sweetened rice dish", "dessert or breakfast", "milk or topping varies"),
    ),
    CatalogFood(
        food_id="ph_turon",
        display_name="Turon",
        aliases=("turon", "banana lumpia", "fried banana roll"),
        portion_labels=("1 piece", "2 pieces", "user-described portion"),
        qualitative_tags=("sweetened snack", "fried or oil varies", "dessert", "portion-sensitive"),
    ),
    CatalogFood(
        food_id="ph_taho",
        display_name="Taho",
        aliases=("taho", "soy pudding", "arnibal", "sago taho"),
        portion_labels=("small cup", "regular cup", "user-described portion"),
        qualitative_tags=("sweetened drink or snack", "syrup varies", "soy context"),
    ),
    CatalogFood(
        food_id="ph_suman",
        display_name="Suman",
        aliases=("suman", "sticky rice cake", "kakanin"),
        portion_labels=("1 piece", "2 pieces", "user-described portion"),
        qualitative_tags=("kakanin", "sticky rice", "sweetened topping varies", "portion-sensitive"),
    ),
    CatalogFood(
        food_id="ph_banana_cue",
        display_name="Banana cue",
        aliases=("banana cue", "bananacue", "fried banana", "saba banana"),
        portion_labels=("1 stick", "1 piece", "2 pieces", "user-described portion"),
        qualitative_tags=("sweetened snack", "fried or oil varies", "sugar coating varies"),
    ),
    CatalogFood(
        food_id="ph_adobo",
        display_name="Adobo",
        aliases=("adobo", "chicken adobo", "pork adobo"),
        portion_labels=("small serving", "regular serving", "user-described portion"),
        qualitative_tags=("mixed dish", "sauce varies", "protein context", "recipe varies"),
    ),
)


def catalog_response(market: str) -> UnlabeledFoodCatalogResponse:
    require_ph_market(market)
    return UnlabeledFoodCatalogResponse(
        market="PH",
        foods=[candidate_from_food(food) for food in CATALOG],
        limitations=CATALOG_LIMITATIONS,
    )


def identify_candidates_from_filename(filename: str | None, market: str) -> UnlabeledFoodIdentifyResponse:
    require_ph_market(market)
    normalized = normalize(filename or "")
    candidates: list[CuratedFoodCandidate] = []
    if normalized:
        for food in CATALOG:
            matched_alias = best_alias_match(normalized, food.aliases)
            if matched_alias:
                confidence = 0.72 if len(normalize(matched_alias)) >= 5 else 0.62
                candidates.append(candidate_from_food(
                    food,
                    match_reason=f'Filename matched catalog alias "{matched_alias}".',
                    confidence=confidence,
                ))
    candidates = sorted(candidates, key=lambda item: (item.confidence or 0, item.display_name), reverse=True)[:5]
    if candidates:
        return UnlabeledFoodIdentifyResponse(
            market="PH",
            candidates=candidates,
            method="filename_alias_demo",
            message="Candidate suggestions are demo hints only. Confirm the catalog food and portion before Smart Context.",
            limitations=CATALOG_LIMITATIONS,
        )
    return UnlabeledFoodIdentifyResponse(
        market="PH",
        candidates=[],
        method="manual_catalog_fallback",
        message="No catalog candidate was identified. Choose the food manually from the curated demo catalog.",
        limitations=CATALOG_LIMITATIONS,
    )


def validate_unlabeled_food_record(request: UnlabeledFoodRecordRequest) -> CuratedFoodRecord:
    require_ph_market(request.market)
    food = food_by_id(request.food_id)
    if not food:
        raise UnknownFoodError(request.food_id)
    portion = request.portion_label.strip()
    if portion not in food.portion_labels:
        raise UnknownPortionError(portion, food.food_id)

    return CuratedFoodRecord(
        record_id=str(uuid.uuid4()),
        food_id=food.food_id,
        market="PH",
        display_name=food.display_name,
        selected_portion_label=portion,
        notes=request.notes.strip() or None,
        qualitative_tags=list(food.qualitative_tags),
        context_flags=context_flags_for_food(food),
        glycemic=GlycemicEvidence(
            status="unavailable",
            reason=(
                "Curated unlabeled demo mode does not include sourced GI or GL. "
                "The confirmed food and portion are qualitative Smart Context only."
            ),
        ),
        limitations=[
            *CATALOG_LIMITATIONS,
            *food.limitations,
        ],
        provenance=Provenance(
            pipeline_version="curated-unlabeled-demo-v1",
            completed_at=datetime.now(timezone.utc),
            external_processors=[],
        ),
    )


class UnknownFoodError(ValueError):
    pass


class UnknownPortionError(ValueError):
    pass


def require_ph_market(market: str) -> None:
    if market != "PH":
        raise UnsupportedMarketError("Curated unlabeled-food demo mode currently supports market=PH only.")


class UnsupportedMarketError(ValueError):
    pass


def candidate_from_food(
    food: CatalogFood,
    *,
    match_reason: str | None = None,
    confidence: float | None = None,
) -> CuratedFoodCandidate:
    return CuratedFoodCandidate(
        food_id=food.food_id,
        display_name=food.display_name,
        market="PH",
        aliases=list(food.aliases),
        portion_labels=list(food.portion_labels),
        qualitative_tags=list(food.qualitative_tags),
        limitations=[*CATALOG_LIMITATIONS, *food.limitations],
        match_reason=match_reason,
        confidence=confidence,
    )


def food_by_id(food_id: str) -> CatalogFood | None:
    return next((food for food in CATALOG if food.food_id == food_id), None)


def best_alias_match(normalized_text: str, aliases: tuple[str, ...]) -> str | None:
    matches = [alias for alias in aliases if re.search(rf"\b{re.escape(normalize(alias))}\b", normalized_text)]
    if not matches:
        return None
    return max(matches, key=len)


def context_flags_for_food(food: CatalogFood) -> list[SmartContextFlag]:
    return [
        SmartContextFlag(
            id=f"tag-{slug(tag)}",
            label=tag,
            category="curated_demo",
            detail="Curated catalog descriptor only; it is not a rating, nutrient value, GI claim, or GL claim.",
            evidence_labels=["Curated demo catalog"],
        )
        for tag in food.qualitative_tags
    ]


def normalize(value: str) -> str:
    lowered = value.lower()
    cleaned = re.sub(r"[^a-z0-9]+", " ", lowered)
    return re.sub(r"\s+", " ", cleaned).strip()


def slug(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))

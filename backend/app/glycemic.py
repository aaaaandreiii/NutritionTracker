from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from .schemas import GlycemicEvidence, NutrientFields, SugarVariant
from .taxonomy import SUGAR_TAXONOMY_VERSION, demo_gi_for_canonical


GL_GREEN_MAX = 10
GL_RED_MIN = 20
HEURISTIC_LICENSING = (
    "No licensed FNRI, Trinidad, or tested-product GI source is bundled. "
    "Values marked heuristic_demo are local demo placeholders, not clinical evidence."
)


@dataclass(frozen=True)
class FoodFormHeuristic:
    canonical_name: str
    demo_gi: int
    aliases: tuple[str, ...]


# Local demo placeholders for common unsweetened food forms that can be identified
# from the product or ingredient text. These are not sourced tested-product GI data.
FOOD_FORM_HEURISTICS = (
    FoodFormHeuristic(
        canonical_name="Rolled oats",
        demo_gi=55,
        aliases=("rolled oats", "rolled oatmeal", "whole grain oats", "oatmeal", "oats"),
    ),
)


def calculate_gl(gi: float, available_carbohydrate_grams: float) -> float:
    value = (Decimal(str(gi)) * Decimal(str(available_carbohydrate_grams))) / Decimal("100")
    return float(value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def gl_band(gl: float) -> str:
    if gl <= GL_GREEN_MAX:
        return "green"
    if gl < GL_RED_MIN:
        return "yellow"
    return "red"


def _value(value: object) -> float | None:
    if isinstance(value, (int, float)) and value >= 0:
        return float(value)
    return None


def demo_net_carbs(nutrients: NutrientFields) -> tuple[float | None, list[str]]:
    limitations: list[str] = []
    allowed_sources = {"label", "user"}
    if (
        nutrients.total_carbohydrate.source_kind not in allowed_sources
        or nutrients.fiber.source_kind not in allowed_sources
    ):
        limitations.append(
            "Demo GL was not computed because total carbohydrate and dietary fiber must come from current-label extraction or user confirmation."
        )
        return None, limitations
    if nutrients.total_carbohydrate.serving_basis != nutrients.fiber.serving_basis:
        limitations.append(
            "Demo GL was not computed because total carbohydrate and dietary fiber use different serving bases."
        )
        return None, limitations

    total_carbohydrate = _value(nutrients.total_carbohydrate.value)
    fiber = _value(nutrients.fiber.value)
    sugar_alcohols = (
        _value(nutrients.sugar_alcohols.value)
        if nutrients.sugar_alcohols.source_kind in allowed_sources
        else None
    )

    if total_carbohydrate is None or fiber is None:
        limitations.append(
            "Demo GL was not computed because total carbohydrate and dietary fiber are required on the same serving basis."
        )
        return None, limitations

    subtract_polyols = sugar_alcohols if sugar_alcohols is not None else 0
    if sugar_alcohols is None:
        limitations.append(
            "Sugar alcohols were unavailable or undeclared, so none were subtracted from demo net carbohydrate."
        )
    net_carbs = max(total_carbohydrate - fiber - subtract_polyols, 0)
    return round(net_carbs, 1), limitations


def _heuristic_candidates(variants: list[SugarVariant]) -> list[tuple[SugarVariant, int]]:
    candidates: list[tuple[SugarVariant, int]] = []
    for variant in variants:
        demo_gi = demo_gi_for_canonical(variant.canonical_name)
        if demo_gi is not None:
            candidates.append((variant, demo_gi))
    return candidates


def _food_form_candidate(product_name: str = "", raw_ingredients: str = "") -> FoodFormHeuristic | None:
    text = f"{product_name} {raw_ingredients}".casefold()
    normalized = re.sub(r"[^a-z0-9\s-]", " ", text)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    for heuristic in FOOD_FORM_HEURISTICS:
        if any(re.search(rf"\b{re.escape(alias)}\b", normalized) for alias in heuristic.aliases):
            return heuristic
    return None


def build_glycemic_evidence(
    nutrients: NutrientFields,
    variants: list[SugarVariant],
    *,
    product_name: str = "",
    raw_ingredients: str = "",
) -> tuple[GlycemicEvidence, list[str]]:
    candidates = _heuristic_candidates(variants)
    food_form = _food_form_candidate(product_name, raw_ingredients)
    if not candidates:
        if food_form:
            net_carbs, limitations = demo_net_carbs(nutrients)
            gl = calculate_gl(food_form.demo_gi, net_carbs) if net_carbs is not None else None
            band = gl_band(gl) if gl is not None else None
            reason = (
                f"Heuristic demo only: food-form text matched {food_form.canonical_name}. "
                "This is not sourced tested-product GI and does not predict individual glucose response."
            )
            return (
                GlycemicEvidence(
                    status="heuristic_demo",
                    tested_food_match_description=f"Demo food-form input uses {food_form.canonical_name} from product or ingredient text.",
                    match_level="same_food_form",
                    gi=float(food_form.demo_gi),
                    available_carbohydrate_grams=net_carbs,
                    gl=gl,
                    gl_band=band,
                    citation=None,
                    licensing=HEURISTIC_LICENSING,
                    reason=reason,
                ),
                [HEURISTIC_LICENSING, *limitations],
            )
        return (
            GlycemicEvidence(
                status="unavailable",
                reason=(
                    "No sourced tested-product GI evidence is bundled, and no sugar-related or food-form alias was matched for the "
                    "clearly labeled heuristic demo."
                ),
            ),
            [HEURISTIC_LICENSING],
        )

    selected_variant, selected_gi = max(candidates, key=lambda item: item[1])
    net_carbs, limitations = demo_net_carbs(nutrients)
    gl = calculate_gl(selected_gi, net_carbs) if net_carbs is not None else None
    band = gl_band(gl) if gl is not None else None
    matched_names = ", ".join(sorted({variant.canonical_name for variant, _gi in candidates}))

    reason = (
        f"Heuristic demo only: taxonomy {SUGAR_TAXONOMY_VERSION} matched {matched_names}. "
        "This is not a tested product GI and does not predict individual glucose response."
    )
    description = (
        f"Demo alias input uses {selected_variant.canonical_name} from ingredient rank "
        f"#{selected_variant.ingredient_rank}; ingredient order does not reveal grams."
    )

    return (
        GlycemicEvidence(
            status="heuristic_demo",
            tested_food_match_description=description,
            match_level="alias_heuristic",
            gi=float(selected_gi),
            available_carbohydrate_grams=net_carbs,
            gl=gl,
            gl_band=band,
            citation=None,
            licensing=HEURISTIC_LICENSING,
            reason=reason,
        ),
        [HEURISTIC_LICENSING, *limitations],
    )

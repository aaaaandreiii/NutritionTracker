from __future__ import annotations

import re
from dataclasses import dataclass

from .schemas import EvidenceReference, SugarVariant


@dataclass(frozen=True)
class Taxon:
    canonical: str
    category: str
    aliases: tuple[str, ...]


# English and commonly printed Filipino label terms. Version changes must be benchmarked.
SUGAR_TAXONOMY_VERSION = "2026.07-en-fil-v1"
TAXONOMY = (
    Taxon("Sucrose", "added sugar", ("sugar", "cane sugar", "sucrose", "asukal", "brown sugar", "raw sugar")),
    Taxon("High-fructose corn syrup", "syrup", ("high fructose corn syrup", "hfcs")),
    Taxon("Glucose syrup", "syrup", ("glucose syrup", "corn syrup", "rice syrup", "brown rice syrup")),
    Taxon("Invert sugar", "added sugar", ("invert sugar", "invert syrup")),
    Taxon("Dextrose", "added sugar", ("dextrose", "glucose")),
    Taxon("Fructose", "added sugar", ("fructose",)),
    Taxon("Maltose", "added sugar", ("maltose", "malt sugar")),
    Taxon("Honey", "added sugar", ("honey", "pulot")),
    Taxon("Molasses", "added sugar", ("molasses", "treacle")),
    Taxon("Maltodextrin", "carbohydrate ingredient", ("maltodextrin",)),
    Taxon("Allulose", "rare sugar", ("allulose",)),
    Taxon("Erythritol", "sugar alcohol", ("erythritol",)),
    Taxon("Xylitol", "sugar alcohol", ("xylitol",)),
    Taxon("Sorbitol", "sugar alcohol", ("sorbitol",)),
    Taxon("Maltitol", "sugar alcohol", ("maltitol",)),
    Taxon("Steviol glycosides", "high-intensity sweetener", ("stevia", "steviol glycosides")),
)


def classify_ingredients(raw: str) -> list[SugarVariant]:
    ingredients = [part.strip() for part in re.split(r",|;", raw) if part.strip()]
    matches: list[SugarVariant] = []
    seen: set[tuple[str, int]] = set()
    for rank, ingredient in enumerate(ingredients, start=1):
        normalized = re.sub(r"[^a-z0-9\s-]", " ", ingredient.lower())
        normalized = re.sub(r"\s+", " ", normalized).strip()
        candidates: list[tuple[int, int, str, Taxon]] = []
        for taxon in TAXONOMY:
            for alias in taxon.aliases:
                for match in re.finditer(rf"\b{re.escape(alias)}\b", normalized):
                    candidates.append((match.start(), match.end(), alias, taxon))
        occupied: list[tuple[int, int]] = []
        for start, end, alias, taxon in sorted(candidates, key=lambda item: (-(item[1] - item[0]), item[0])):
            if any(start < used_end and end > used_start for used_start, used_end in occupied):
                continue
            key = (taxon.canonical, rank)
            if key not in seen:
                seen.add(key)
                occupied.append((start, end))
                matches.append(SugarVariant(
                    raw_span=alias,
                    canonical_name=taxon.canonical,
                    category=taxon.category,
                    ingredient_rank=rank,
                    evidence=EvidenceReference(
                        image_kind="ingredients",
                        note="Matched from user-confirmed ingredient text.",
                    ),
                ))
    return sorted(matches, key=lambda item: (item.ingredient_rank, item.canonical_name))

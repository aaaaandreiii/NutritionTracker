from __future__ import annotations

import re
from dataclasses import dataclass

from .schemas import EvidenceReference, SugarVariant


@dataclass(frozen=True)
class Taxon:
    canonical: str
    category: str
    aliases: tuple[str, ...]
    demo_gi: int | None


# English and commonly printed Filipino label terms. Version changes must be benchmarked.
# demo_gi values are local heuristic placeholders for the clearly labeled GL demo only.
SUGAR_TAXONOMY_VERSION = "2026.08-en-fil-demo-v1"
TAXONOMY = (
    Taxon("Sucrose", "added sugar", ("sugar", "cane sugar", "sucrose", "table sugar", "white sugar", "granulated sugar", "asukal"), 65),
    Taxon("Brown sugar", "added sugar", ("brown sugar", "light brown sugar", "dark brown sugar", "raw sugar", "muscovado", "demerara sugar", "turbinado sugar"), 65),
    Taxon("Coconut sugar", "added sugar", ("coconut sugar", "coconut palm sugar", "coco sugar", "coco sap sugar", "coconut sap sugar"), 54),
    Taxon("High-fructose corn syrup", "syrup", ("high fructose corn syrup", "high-fructose corn syrup", "hfcs", "fructose glucose syrup"), 62),
    Taxon("Corn syrup", "syrup", ("corn syrup", "corn syrup solids", "glucose-fructose syrup"), 75),
    Taxon("Glucose syrup", "syrup", ("glucose syrup", "rice syrup", "brown rice syrup", "tapioca syrup", "wheat syrup"), 90),
    Taxon("Invert sugar", "added sugar", ("invert sugar", "invert syrup", "inverted sugar syrup"), 60),
    Taxon("Dextrose", "added sugar", ("dextrose", "glucose", "d-glucose", "anhydrous dextrose"), 100),
    Taxon("Fructose", "added sugar", ("fructose", "crystalline fructose", "fruit sugar"), 23),
    Taxon("Maltose", "added sugar", ("maltose", "malt sugar", "malted sugar"), 105),
    Taxon("Lactose", "milk sugar", ("lactose", "milk sugar"), 46),
    Taxon("Honey", "added sugar", ("honey", "pulot"), 58),
    Taxon("Molasses", "added sugar", ("molasses", "blackstrap molasses", "treacle"), 55),
    Taxon("Maple syrup", "syrup", ("maple syrup", "maple sugar"), 54),
    Taxon("Agave syrup", "syrup", ("agave syrup", "agave nectar"), 30),
    Taxon("Golden syrup", "syrup", ("golden syrup", "refiner's syrup", "refiners syrup"), 60),
    Taxon("Date sugar", "added sugar", ("date sugar", "date syrup", "date paste"), 55),
    Taxon("Fruit juice concentrate", "added sugar", ("fruit juice concentrate", "apple juice concentrate", "grape juice concentrate", "pear juice concentrate"), 55),
    Taxon("Evaporated cane juice", "added sugar", ("evaporated cane juice", "cane juice solids", "dried cane syrup"), 65),
    Taxon("Maltodextrin", "carbohydrate ingredient", ("maltodextrin", "dextrin", "corn dextrin", "resistant maltodextrin"), 95),
    Taxon("Allulose", "rare sugar", ("allulose", "d-allulose", "psicose"), 0),
    Taxon("Tagatose", "rare sugar", ("tagatose", "d-tagatose"), 3),
    Taxon("Isomaltulose", "slow carbohydrate", ("isomaltulose", "palatinose"), 32),
    Taxon("Erythritol", "sugar alcohol", ("erythritol",), 0),
    Taxon("Xylitol", "sugar alcohol", ("xylitol",), 12),
    Taxon("Sorbitol", "sugar alcohol", ("sorbitol", "sorbitol syrup"), 9),
    Taxon("Maltitol", "sugar alcohol", ("maltitol", "maltitol syrup"), 35),
    Taxon("Isomalt", "sugar alcohol", ("isomalt",), 9),
    Taxon("Mannitol", "sugar alcohol", ("mannitol",), 2),
    Taxon("Lactitol", "sugar alcohol", ("lactitol",), 6),
    Taxon("Polydextrose", "fiber-like carbohydrate", ("polydextrose",), 7),
    Taxon("Steviol glycosides", "high-intensity sweetener", ("stevia", "steviol glycosides", "stevia extract", "reb a", "rebaudioside a"), 0),
    Taxon("Sucralose", "high-intensity sweetener", ("sucralose",), 0),
    Taxon("Aspartame", "high-intensity sweetener", ("aspartame",), 0),
    Taxon("Acesulfame potassium", "high-intensity sweetener", ("acesulfame potassium", "acesulfame k", "ace-k", "ace k"), 0),
    Taxon("Saccharin", "high-intensity sweetener", ("saccharin", "sodium saccharin"), 0),
    Taxon("Monk fruit extract", "high-intensity sweetener", ("monk fruit", "monk fruit extract", "luo han guo"), 0),
)

_TAXON_BY_CANONICAL = {taxon.canonical: taxon for taxon in TAXONOMY}


def sugar_alias_count() -> int:
    return len({alias for taxon in TAXONOMY for alias in taxon.aliases})


def demo_gi_for_canonical(canonical: str) -> int | None:
    taxon = _TAXON_BY_CANONICAL.get(canonical)
    return taxon.demo_gi if taxon else None


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

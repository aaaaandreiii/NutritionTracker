from __future__ import annotations

import os
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from ..schemas import (
    OffProductLookupResponse,
    OffProductNutrientPreview,
    OffProductPreview,
    OffProductQualitativeMarkers,
)


DEFAULT_OFF_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "off_ph_products.db"
LOCAL_OFF_SOURCE_NAME = "Open Food Facts local"
LOCAL_OFF_SOURCE_KIND = "local_open_food_facts"
OFF_SOURCE_URL = "https://world.openfoodfacts.org/product/{barcode}"

LookupStatus = Literal["found", "not_found", "disabled", "db_missing", "unsupported_market"]

REQUIRED_FIELD_LABELS: dict[str, str] = {
    "productName": "product name",
    "servingSize": "serving size",
    "totalCarbohydrate": "total carbohydrate",
    "totalSugars": "total sugars",
    "fiber": "dietary fiber",
    "protein": "protein",
    "fat": "total fat",
}

NUTRIENT_TO_COLUMN = {
    "carbohydrates": "total_carbohydrate_g",
    "fiber": "fiber_g",
    "sugars": "total_sugars_g",
    "added-sugars": "added_sugars_g",
    "polyols": "sugar_alcohols_g",
    "proteins": "protein_g",
    "fat": "fat_g",
}


@dataclass(frozen=True)
class LocalOffLookup:
    barcode: str
    market: Literal["PH", "US"]
    status: LookupStatus
    product: dict[str, Any] | None = None
    source_url: str | None = None
    missing_fields: tuple[str, ...] = ()

    @property
    def complete(self) -> bool:
        return self.status == "found" and not self.missing_fields


def off_lookup_enabled() -> bool:
    return os.getenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "false").casefold() == "true"


def off_db_path() -> Path:
    configured = os.getenv("SUGAR_PAI_OFF_DB_PATH")
    return Path(configured).expanduser() if configured else DEFAULT_OFF_DB_PATH


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    if not text or text in {"-", "—"} or text.casefold() in {"unknown", "null", "none", "nan"}:
        return None
    return text


def number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and value >= 0:
        return round(float(value), 3)
    text = clean_text(value)
    if not text:
        return None
    match = re.search(r"-?\d+(?:[.,]\d+)?", text)
    if not match:
        return None
    parsed = float(match.group(0).replace(",", "."))
    if parsed < 0:
        return None
    return round(parsed, 3)


def parse_serving_size(value: Any) -> tuple[float | None, str | None, str | None]:
    text = clean_text(value)
    if not text:
        return None, None, None
    match = re.search(r"([0-9]+(?:[.,][0-9]+)?)\s*(g|gram|grams|ml|mL|milliliter|milliliters|oz)\b", text)
    if not match:
        return None, None, text[:100]
    unit = match.group(2)
    normalized_unit = "g" if unit in {"gram", "grams"} else "mL" if unit in {"ml", "milliliter", "milliliters"} else unit
    return round(float(match.group(1).replace(",", ".")), 3), normalized_unit, text[:100]


def product_missing_fields(product: dict[str, Any] | None) -> list[str]:
    if not product:
        return list(REQUIRED_FIELD_LABELS)

    nutriments = product.get("nutriments") if isinstance(product.get("nutriments"), dict) else {}
    serving_size = product.get("serving_quantity")
    if serving_size is None:
        serving_size, _unit, _household = parse_serving_size(product.get("serving_size"))

    missing: list[str] = []
    if not clean_text(product.get("product_name")):
        missing.append(REQUIRED_FIELD_LABELS["productName"])
    if number(serving_size) is None:
        missing.append(REQUIRED_FIELD_LABELS["servingSize"])

    required_nutrients = (
        ("carbohydrates_serving", "totalCarbohydrate"),
        ("sugars_serving", "totalSugars"),
        ("fiber_serving", "fiber"),
        ("proteins_serving", "protein"),
        ("fat_serving", "fat"),
    )
    for key, field_id in required_nutrients:
        if number(nutriments.get(key)) is None:
            missing.append(REQUIRED_FIELD_LABELS[field_id])
    return missing


def local_off_product_is_complete(product: dict[str, Any] | None) -> bool:
    return not product_missing_fields(product)


def lookup_local_off_product(barcode: str, market: Literal["PH", "US"] = "PH") -> LocalOffLookup:
    normalized = re.sub(r"\D", "", barcode)
    if not off_lookup_enabled():
        return LocalOffLookup(normalized, market, "disabled")
    if market != "PH":
        return LocalOffLookup(normalized, market, "unsupported_market")

    path = off_db_path()
    if not path.exists():
        return LocalOffLookup(normalized, market, "db_missing")

    try:
        with sqlite3.connect(path) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                "SELECT * FROM off_ph_products WHERE code = ?",
                (normalized,),
            ).fetchone()
    except sqlite3.Error:
        return LocalOffLookup(normalized, market, "db_missing")

    if row is None:
        return LocalOffLookup(normalized, market, "not_found", source_url=OFF_SOURCE_URL.format(barcode=normalized))

    product = product_from_row(row)
    missing = tuple(product_missing_fields(product))
    return LocalOffLookup(
        normalized,
        market,
        "found",
        product=product,
        source_url=product["source_url"],
        missing_fields=missing,
    )


def product_from_row(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    nutriments: dict[str, float | None] = {}
    for off_key, column in NUTRIENT_TO_COLUMN.items():
        value = number(data.get(column))
        nutriments[f"{off_key}_serving"] = value
        value_100g = number(data.get(f"{column.removesuffix('_g')}_100g"))
        if value_100g is not None:
            nutriments[f"{off_key}_100g"] = value_100g

    code = str(data["code"])
    return {
        "code": code,
        "product_name": clean_text(data.get("product_name")),
        "brands": clean_text(data.get("brands")),
        "quantity": clean_text(data.get("quantity")),
        "categories": clean_text(data.get("categories")),
        "labels": clean_text(data.get("labels")),
        "countries_tags": clean_text(data.get("countries_tags")),
        "serving_size": clean_text(data.get("serving_size")),
        "serving_quantity": number(data.get("serving_size_value")),
        "serving_unit": clean_text(data.get("serving_size_unit")),
        "serving_household_measure": clean_text(data.get("serving_size_household")),
        "servings_per_container": number(data.get("servings_per_container")),
        "nutriments": nutriments,
        "ingredients_text_en": clean_text(data.get("ingredients_text_en")),
        "ingredients_text": clean_text(data.get("ingredients_text")),
        "allergens": clean_text(data.get("allergens")),
        "allergens_tags": clean_text(data.get("allergens_tags")),
        "traces": clean_text(data.get("traces")),
        "traces_tags": clean_text(data.get("traces_tags")),
        "nova_group": clean_text(data.get("nova_group")),
        "nova_groups_tags": clean_text(data.get("nova_groups_tags")),
        "nutriscore_grade": clean_text(data.get("nutriscore_grade")),
        "nutriscore_score": number(data.get("nutriscore_score")),
        "link": clean_text(data.get("link")),
        "source_url": clean_text(data.get("link")) or OFF_SOURCE_URL.format(barcode=code),
        "_lookup_source": LOCAL_OFF_SOURCE_KIND,
    }


def lookup_response(barcode: str, market: Literal["PH", "US"] = "PH") -> OffProductLookupResponse:
    lookup = lookup_local_off_product(barcode, market)
    product = lookup.product
    return OffProductLookupResponse(
        barcode=lookup.barcode,
        market=lookup.market,
        status=lookup.status,
        complete=lookup.complete,
        missing_fields=list(lookup.missing_fields),
        product=preview_from_product(product) if product else None,
        ingredients=clean_text(product.get("ingredients_text_en") or product.get("ingredients_text")) if product else None,
        qualitative_markers=qualitative_markers_from_product(product) if product else None,
        source_url=lookup.source_url,
        source_kind=LOCAL_OFF_SOURCE_KIND,
        message=message_for_lookup(lookup),
    )


def preview_from_product(product: dict[str, Any]) -> OffProductPreview:
    serving_size = number(product.get("serving_quantity"))
    if serving_size is None:
        serving_size, _unit, _household = parse_serving_size(product.get("serving_size"))
    serving_unit = clean_text(product.get("serving_unit"))
    if not serving_unit:
        _amount, serving_unit, _household = parse_serving_size(product.get("serving_size"))
    nutriments = product.get("nutriments") if isinstance(product.get("nutriments"), dict) else {}
    return OffProductPreview(
        barcode=str(product.get("code") or ""),
        product_name=clean_text(product.get("product_name")),
        brand=clean_text(product.get("brands")),
        serving_size=serving_size,
        serving_unit=serving_unit,
        serving_basis="per database serving" if serving_size is not None else "unavailable",
        nutrients=OffProductNutrientPreview(
            total_carbohydrate=number(nutriments.get("carbohydrates_serving")),
            fiber=number(nutriments.get("fiber_serving")),
            total_sugars=number(nutriments.get("sugars_serving")),
            added_sugars=number(nutriments.get("added-sugars_serving")),
            sugar_alcohols=number(nutriments.get("polyols_serving")),
            protein=number(nutriments.get("proteins_serving")),
            fat=number(nutriments.get("fat_serving")),
        ),
    )


def qualitative_markers_from_product(product: dict[str, Any]) -> OffProductQualitativeMarkers:
    return OffProductQualitativeMarkers(
        nova_group=clean_text(product.get("nova_group")),
        nova_groups_tags=clean_text(product.get("nova_groups_tags")),
        nutriscore_grade=clean_text(product.get("nutriscore_grade")),
        nutriscore_score=number(product.get("nutriscore_score")),
        allergens=clean_text(product.get("allergens")),
        allergens_tags=clean_text(product.get("allergens_tags")),
        traces=clean_text(product.get("traces")),
        traces_tags=clean_text(product.get("traces_tags")),
        categories=clean_text(product.get("categories")),
        labels=clean_text(product.get("labels")),
    )


def message_for_lookup(lookup: LocalOffLookup) -> str:
    if lookup.status == "disabled":
        return "Local Open Food Facts lookup is disabled in this environment."
    if lookup.status == "db_missing":
        return f"Local Open Food Facts database was not found at {off_db_path()}."
    if lookup.status == "unsupported_market":
        return "The bundled local Open Food Facts database currently supports the Philippines market."
    if lookup.status == "not_found":
        return "No local Open Food Facts record matched this barcode."
    if lookup.complete:
        return "A complete local Open Food Facts record is available for review."
    return "A partial local Open Food Facts record is available; capture label photos for the missing fields."

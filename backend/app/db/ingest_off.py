from __future__ import annotations

import argparse
import csv
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .off_products import clean_text, number, parse_serving_size


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CSV_PATH = PROJECT_ROOT / "research" / "openfoodfacts_export.csv"
DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "off_ph_products.db"

NUTRIENTS = {
    "total_carbohydrate": ("carbohydrates", "carbohydrates-total"),
    "fiber": ("fiber",),
    "total_sugars": ("sugars",),
    "added_sugars": ("added-sugars",),
    "sugar_alcohols": ("polyols",),
    "protein": ("proteins",),
    "fat": ("fat",),
}


def ingest_off_csv(csv_path: Path = DEFAULT_CSV_PATH, db_path: Path = DEFAULT_DB_PATH) -> int:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.execute("DROP TABLE IF EXISTS off_ph_products")
        connection.execute(SCHEMA)
        count = 0
        imported_at = datetime.now(timezone.utc).isoformat()
        with csv_path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                code = clean_text(row.get("code"))
                if not code:
                    continue
                connection.execute(
                    INSERT_SQL,
                    normalize_row(row, imported_at),
                )
                count += 1
        connection.execute("CREATE INDEX IF NOT EXISTS idx_off_ph_product_name ON off_ph_products(product_name)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_off_ph_brands ON off_ph_products(brands)")
    return count


def normalize_row(row: dict[str, str], imported_at: str) -> dict[str, Any]:
    serving_quantity = number(row.get("nutrition.input_sets.packaging.as_sold.serving.per_quantity"))
    serving_unit = clean_text(row.get("nutrition.input_sets.packaging.as_sold.serving.per_unit"))
    parsed_size, parsed_unit, household = parse_serving_size(row.get("serving_size"))
    serving_size_value = serving_quantity if serving_quantity is not None else parsed_size
    serving_size_unit = serving_unit or parsed_unit

    values: dict[str, Any] = {
        "code": clean_text(row.get("code")),
        "market": "PH",
        "product_name": first_text(row, "product_name_en", "product_name_tl", "product_name_xx", "generic_name_en"),
        "brands": clean_text(row.get("brands")),
        "quantity": clean_text(row.get("quantity")),
        "categories": clean_text(row.get("categories")),
        "labels": clean_text(row.get("labels")),
        "countries_tags": clean_text(row.get("countries_tags")),
        "serving_size": clean_text(row.get("serving_size")),
        "serving_size_value": serving_size_value,
        "serving_size_unit": serving_size_unit,
        "serving_size_household": household,
        "servings_per_container": number(row.get("servings_per_container")),
        "ingredients_text_en": clean_text(row.get("ingredients_text_en")),
        "ingredients_text": first_text(row, "ingredients_text", "ingredients_text_tl", "ingredients_text_xx"),
        "allergens": clean_text(row.get("allergens")),
        "allergens_tags": clean_text(row.get("allergens_tags")),
        "traces": clean_text(row.get("traces")),
        "traces_tags": clean_text(row.get("traces_tags")),
        "nova_group": clean_text(row.get("off:nova_groups")),
        "nova_groups_tags": clean_text(row.get("off:nova_groups_tags")),
        "nutriscore_grade": clean_text(row.get("off:nutriscore_grade")),
        "nutriscore_score": number(row.get("off:nutriscore_score")),
        "link": clean_text(row.get("link")),
        "imported_at": imported_at,
    }

    for target, aliases in NUTRIENTS.items():
        serving_value = first_nutrient_value(row, aliases, "serving")
        value_100g = first_nutrient_value(row, aliases, "100g")
        if serving_value is None:
            serving_value = derive_serving_value(value_100g, serving_size_value, serving_size_unit)
        values[f"{target}_g"] = serving_value
        values[f"{target}_100g"] = value_100g
    return values


def first_text(row: dict[str, str], *keys: str) -> str | None:
    for key in keys:
        value = clean_text(row.get(key))
        if value:
            return value
    return None


def first_nutrient_value(row: dict[str, str], aliases: tuple[str, ...], basis: str) -> float | None:
    for nutrient in aliases:
        keys = (
            f"nutrition.input_sets.packaging.as_sold.{basis}.nutrients.{nutrient}.value",
            f"{nutrient}_{basis}",
        )
        for key in keys:
            value = number(row.get(key))
            if value is not None:
                return value
    return None


def derive_serving_value(value_100g: float | None, serving_size: float | None, serving_unit: str | None) -> float | None:
    if value_100g is None or serving_size is None:
        return None
    if (serving_unit or "").casefold() not in {"g", "ml"}:
        return None
    return round((value_100g * serving_size) / 100, 3)


SCHEMA = """
CREATE TABLE off_ph_products (
    code TEXT PRIMARY KEY,
    market TEXT NOT NULL,
    product_name TEXT,
    brands TEXT,
    quantity TEXT,
    categories TEXT,
    labels TEXT,
    countries_tags TEXT,
    serving_size TEXT,
    serving_size_value REAL,
    serving_size_unit TEXT,
    serving_size_household TEXT,
    servings_per_container REAL,
    ingredients_text_en TEXT,
    ingredients_text TEXT,
    allergens TEXT,
    allergens_tags TEXT,
    traces TEXT,
    traces_tags TEXT,
    nova_group TEXT,
    nova_groups_tags TEXT,
    nutriscore_grade TEXT,
    nutriscore_score REAL,
    link TEXT,
    total_carbohydrate_g REAL,
    total_carbohydrate_100g REAL,
    fiber_g REAL,
    fiber_100g REAL,
    total_sugars_g REAL,
    total_sugars_100g REAL,
    added_sugars_g REAL,
    added_sugars_100g REAL,
    sugar_alcohols_g REAL,
    sugar_alcohols_100g REAL,
    protein_g REAL,
    protein_100g REAL,
    fat_g REAL,
    fat_100g REAL,
    imported_at TEXT NOT NULL
)
"""

INSERT_COLUMNS = [
    "code",
    "market",
    "product_name",
    "brands",
    "quantity",
    "categories",
    "labels",
    "countries_tags",
    "serving_size",
    "serving_size_value",
    "serving_size_unit",
    "serving_size_household",
    "servings_per_container",
    "ingredients_text_en",
    "ingredients_text",
    "allergens",
    "allergens_tags",
    "traces",
    "traces_tags",
    "nova_group",
    "nova_groups_tags",
    "nutriscore_grade",
    "nutriscore_score",
    "link",
    "total_carbohydrate_g",
    "total_carbohydrate_100g",
    "fiber_g",
    "fiber_100g",
    "total_sugars_g",
    "total_sugars_100g",
    "added_sugars_g",
    "added_sugars_100g",
    "sugar_alcohols_g",
    "sugar_alcohols_100g",
    "protein_g",
    "protein_100g",
    "fat_g",
    "fat_100g",
    "imported_at",
]
INSERT_SQL = f"""
INSERT OR REPLACE INTO off_ph_products ({", ".join(INSERT_COLUMNS)})
VALUES ({", ".join(f":{column}" for column in INSERT_COLUMNS)})
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the local Philippine Open Food Facts SQLite database.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV_PATH, help="Source Open Food Facts CSV export.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="Destination SQLite database.")
    args = parser.parse_args()
    count = ingest_off_csv(args.csv, args.db)
    print(f"Ingested {count} Open Food Facts rows into {args.db}")


if __name__ == "__main__":
    main()

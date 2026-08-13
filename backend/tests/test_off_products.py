from __future__ import annotations

import sqlite3
from pathlib import Path

from app.db.ingest_off import ingest_off_csv
from app.db.off_products import lookup_local_off_product, lookup_response


CSV_PATH = Path(__file__).resolve().parents[2] / "research" / "openfoodfacts_export.csv"


def build_test_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "off_ph_products.db"
    ingest_off_csv(CSV_PATH, db_path)
    return db_path


def test_ingest_builds_sqlite_and_parses_nescafe(tmp_path, monkeypatch):
    db_path = build_test_db(tmp_path)

    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT code, product_name, serving_size_value, serving_size_unit,
                   total_carbohydrate_g, total_sugars_g, fiber_g, protein_g, fat_g
            FROM off_ph_products
            WHERE code = '4800361403764'
            """,
        ).fetchone()

    assert row == (
        "4800361403764",
        "nescafe original 20g",
        20.0,
        "g",
        14.0,
        9.7,
        0.34,
        0.27,
        3.4,
    )

    monkeypatch.setenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "true")
    monkeypatch.setenv("SUGAR_PAI_OFF_DB_PATH", str(db_path))
    complete = lookup_response("4800361403764")
    partial = lookup_response("4806531830040")

    assert complete.complete is True
    assert complete.missing_fields == []
    assert partial.complete is False
    assert "serving size" in partial.missing_fields
    assert "total carbohydrate" in partial.missing_fields


def test_lookup_statuses_for_found_partial_not_found_disabled_and_missing_db(tmp_path, monkeypatch):
    db_path = build_test_db(tmp_path)
    monkeypatch.setenv("SUGAR_PAI_OFF_DB_PATH", str(db_path))

    monkeypatch.setenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "true")
    assert lookup_local_off_product("4800361403764").complete is True

    partial = lookup_local_off_product("4806531830040")
    assert partial.status == "found"
    assert partial.complete is False

    missing = lookup_local_off_product("0000000000000")
    assert missing.status == "not_found"
    assert missing.product is None

    monkeypatch.setenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "false")
    assert lookup_local_off_product("4800361403764").status == "disabled"

    monkeypatch.setenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "true")
    monkeypatch.setenv("SUGAR_PAI_OFF_DB_PATH", str(tmp_path / "missing.db"))
    assert lookup_local_off_product("4800361403764").status == "db_missing"

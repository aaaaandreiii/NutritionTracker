from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


@dataclass(frozen=True)
class GiRecord:
    food_name: str
    gi: float
    source_title: str
    source_url: str | None
    license_status: Literal["licensed", "synthetic"]


def default_gi_fixture_path() -> Path:
    return Path(__file__).with_name("data") / "synthetic_gi_fixture.json"


def load_gi_records(path: Path | None = None) -> list[GiRecord]:
    source = path or default_gi_fixture_path()
    with source.open("r", encoding="utf-8") as handle:
        rows = json.load(handle)
    return [
        GiRecord(
            food_name=str(row["food_name"]),
            gi=float(row["gi"]),
            source_title=str(row["source_title"]),
            source_url=row.get("source_url"),
            license_status=row["license_status"],
        )
        for row in rows
    ]


def find_sourced_gi(food_name: str, records: list[GiRecord]) -> GiRecord | None:
    normalized = food_name.casefold().strip()
    for record in records:
        if record.license_status == "licensed" and record.food_name.casefold() == normalized:
            return record
    return None

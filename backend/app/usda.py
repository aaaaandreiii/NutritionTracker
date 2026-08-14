from __future__ import annotations

import asyncio
import math
import os
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from .schemas import (
    FoodDataCandidate,
    FoodDataSearchResponse,
    NumericRange,
    SourceMetadata,
    UsdaNutrientProfile,
)


USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1"
USDA_SOURCE_URL = "https://fdc.nal.usda.gov/"
MAX_CANDIDATES = 5
_CACHE_TTL_SECONDS = 60 * 60
_SEARCH_CACHE: dict[tuple[str, int], tuple[float, FoodDataSearchResponse]] = {}
_DETAIL_CACHE: dict[int, tuple[float, FoodDataCandidate]] = {}

NUTRIENT_KEYS = (
    "total_carbohydrate",
    "fiber",
    "total_sugars",
    "added_sugars",
    "sugar_alcohols",
    "protein",
    "fat",
)

_NUTRIENT_NUMBERS = {
    "203": "protein",
    "204": "fat",
    "205": "total_carbohydrate",
    "269": "total_sugars",
    "291": "fiber",
    "539": "added_sugars",
    "1003": "protein",
    "1004": "fat",
    "1005": "total_carbohydrate",
    "1079": "fiber",
    "1086": "sugar_alcohols",
    "1235": "added_sugars",
    "2000": "total_sugars",
}

_NUTRIENT_NAMES = {
    "carbohydrate, by difference": "total_carbohydrate",
    "carbohydrate": "total_carbohydrate",
    "fiber, total dietary": "fiber",
    "dietary fiber": "fiber",
    "sugars, total including nlea": "total_sugars",
    "sugars, total": "total_sugars",
    "total sugars": "total_sugars",
    "sugars, added": "added_sugars",
    "added sugars": "added_sugars",
    "sugar alcohol": "sugar_alcohols",
    "sugar alcohols": "sugar_alcohols",
    "protein": "protein",
    "total lipid (fat)": "fat",
    "total fat": "fat",
}


class UsdaUnavailableError(RuntimeError):
    pass


class UsdaRequestError(RuntimeError):
    pass


def usda_configured() -> bool:
    return bool(os.getenv("USDA_FDC_API_KEY", "").strip())


async def search_food_data(query: str, limit: int = MAX_CANDIDATES) -> FoodDataSearchResponse:
    normalized = " ".join(query.split()).strip()
    if not normalized:
        return FoodDataSearchResponse(query="", available=usda_configured(), warning="Enter a food name to search.")
    limit = max(1, min(limit, MAX_CANDIDATES))
    key = os.getenv("USDA_FDC_API_KEY", "").strip()
    if not key:
        return FoodDataSearchResponse(
            query=normalized,
            available=False,
            warning="USDA FoodData Central is not configured; use the curated qualitative fallback.",
        )

    cache_key = (normalized.casefold(), limit)
    cached = _fresh(_SEARCH_CACHE.get(cache_key))
    if cached is not None:
        return cached

    params = {
        "api_key": key,
        "query": normalized,
        "pageSize": limit,
        "pageNumber": 1,
        "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"],
    }
    timeout = float(os.getenv("USDA_FDC_TIMEOUT_SECONDS", "12"))
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
            response = await client.get(f"{USDA_API_BASE}/foods/search", params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException as exc:
        raise UsdaRequestError(f"USDA FoodData Central search timed out after {timeout:g}s.") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise UsdaRequestError("USDA FoodData Central search is temporarily unavailable.") from exc

    candidates: list[FoodDataCandidate] = []
    for item in payload.get("foods", []):
        if len(candidates) >= limit:
            break
        try:
            candidates.append(parse_food_candidate(item))
        except (TypeError, ValueError):
            continue
    result = FoodDataSearchResponse(query=normalized, candidates=candidates, available=True)
    _SEARCH_CACHE[cache_key] = (time.monotonic(), result)
    return result


async def get_food_data_details(fdc_id: int) -> FoodDataCandidate:
    cached = _fresh(_DETAIL_CACHE.get(fdc_id))
    if cached is not None:
        return cached
    key = os.getenv("USDA_FDC_API_KEY", "").strip()
    if not key:
        raise UsdaUnavailableError("USDA FoodData Central is not configured.")
    timeout = float(os.getenv("USDA_FDC_TIMEOUT_SECONDS", "12"))
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
            response = await client.get(f"{USDA_API_BASE}/food/{fdc_id}", params={"api_key": key})
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException as exc:
        raise UsdaRequestError(f"USDA FoodData Central details timed out after {timeout:g}s.") from exc
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise UsdaRequestError("The selected USDA food record was not found.") from exc
        raise UsdaRequestError("USDA FoodData Central details are temporarily unavailable.") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise UsdaRequestError("USDA FoodData Central details are temporarily unavailable.") from exc

    candidate = parse_food_candidate(payload)
    _DETAIL_CACHE[fdc_id] = (time.monotonic(), candidate)
    return candidate


def parse_food_candidate(food: dict[str, Any]) -> FoodDataCandidate:
    fdc_id = int(food.get("fdcId") or food.get("fdc_id") or 0)
    if fdc_id <= 0:
        raise ValueError("USDA food result did not include a valid FDC ID.")
    return FoodDataCandidate(
        fdc_id=fdc_id,
        description=str(food.get("description") or "USDA food").strip(),
        data_type=_string_or_none(food.get("dataType")),
        brand_owner=_string_or_none(food.get("brandOwner") or food.get("brandName")),
        ingredients=_string_or_none(food.get("ingredients")),
        nutrients_per_100g=parse_nutrient_profile(food.get("foodNutrients") or []),
        source=SourceMetadata(
            source_id=f"usda-fdc-{fdc_id}",
            name="USDA FoodData Central",
            url=f"{USDA_SOURCE_URL}/food-details/{fdc_id}/nutrients",
            dataset_version=_string_or_none(food.get("publicationDate") or food.get("modifiedDate")),
            retrieved_at=datetime.now(timezone.utc),
        ),
    )


def parse_nutrient_profile(items: list[dict[str, Any]]) -> UsdaNutrientProfile:
    values: dict[str, float | None] = {key: None for key in NUTRIENT_KEYS}
    for item in items:
        nutrient = item.get("nutrient") if isinstance(item.get("nutrient"), dict) else item
        number = str(nutrient.get("number") or nutrient.get("nutrientNumber") or item.get("nutrientNumber") or "")
        name = str(nutrient.get("name") or item.get("nutrientName") or "").casefold().strip()
        key = _NUTRIENT_NUMBERS.get(number) or _NUTRIENT_NAMES.get(name)
        if not key or values[key] is not None:
            continue
        amount = item.get("amount", item.get("value"))
        if amount is None:
            continue
        try:
            parsed = float(amount)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(parsed):
            continue
        unit = str(nutrient.get("unitName") or item.get("unitName") or "g").casefold()
        if unit == "mg":
            parsed /= 1000
        elif unit in {"µg", "ug"}:
            parsed /= 1_000_000
        values[key] = max(0.0, round(parsed, 6))
    return UsdaNutrientProfile(**values)


def calculate_nutrient_ranges(
    nutrients_per_100g: UsdaNutrientProfile,
    gram_range: NumericRange,
) -> dict[str, NumericRange | None]:
    result: dict[str, NumericRange | None] = {}
    for key in NUTRIENT_KEYS:
        amount = getattr(nutrients_per_100g, key)
        if amount is None:
            result[key] = None
            continue
        result[key] = NumericRange(
            minimum=_round_nutrient(amount * gram_range.minimum / 100),
            maximum=_round_nutrient(amount * gram_range.maximum / 100),
            unit="g",
        )
    return result


def clear_usda_cache() -> None:
    _SEARCH_CACHE.clear()
    _DETAIL_CACHE.clear()


def _round_nutrient(value: float) -> float:
    return round(value + 1e-12, 2)


def _fresh(entry: tuple[float, Any] | None) -> Any | None:
    if entry is None:
        return None
    created, value = entry
    if time.monotonic() - created > _CACHE_TTL_SECONDS:
        return None
    return value


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


async def hydrate_candidates(names: list[str]) -> list[FoodDataSearchResponse]:
    """Search component names concurrently while preserving their input order."""
    return await asyncio.gather(*(search_food_data(name) for name in names))

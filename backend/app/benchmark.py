from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any


NUMERIC_FIELDS = ("servingSize", "totalCarbohydrate", "fiber", "totalSugars", "addedSugars")


def load_rows(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError(f"{path} must contain a JSON array.")
    return payload


def exact_match(expected: float | None, observed: float | None, tolerance: float = 0.05) -> bool:
    if expected is None or observed is None:
        return expected is observed
    return abs(float(expected) - float(observed)) <= tolerance


def sugar_span_set(rows: list[dict[str, Any]]) -> set[tuple[str, int]]:
    return {
        (str(row.get("canonicalName", "")).casefold(), int(row.get("ingredientRank", 0)))
        for row in rows
        if row.get("canonicalName") and row.get("ingredientRank")
    }


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = math.ceil((pct / 100) * len(ordered)) - 1
    return round(ordered[max(0, min(index, len(ordered) - 1))], 3)


def compute_metrics(annotations: list[dict[str, Any]], predictions: list[dict[str, Any]]) -> dict[str, Any]:
    prediction_by_id = {row["productId"]: row for row in predictions}
    exact_counts = Counter()
    exact_totals = Counter()
    sugar_abs_errors: list[float] = []
    true_positive = false_positive = false_negative = 0
    latency_values: list[float] = []
    api_errors = 0
    fallback_counts: Counter[str] = Counter()
    schema_valid_after_retry = 0
    prediction_count = 0

    for annotation in annotations:
        product_id = annotation["productId"]
        prediction = prediction_by_id.get(product_id)
        if not prediction:
            fallback_counts["missing_prediction"] += 1
            continue
        prediction_count += 1
        gold = annotation["gold"]
        extracted = prediction.get("extracted", {})

        for field in NUMERIC_FIELDS:
            exact_totals[field] += 1
            if exact_match(gold.get(field), extracted.get(field)):
                exact_counts[field] += 1

        if gold.get("totalSugars") is not None and extracted.get("totalSugars") is not None:
            sugar_abs_errors.append(abs(float(gold["totalSugars"]) - float(extracted["totalSugars"])))

        expected_spans = sugar_span_set(gold.get("sugarSpans", []))
        observed_spans = sugar_span_set(extracted.get("sugarSpans", []))
        true_positive += len(expected_spans & observed_spans)
        false_positive += len(observed_spans - expected_spans)
        false_negative += len(expected_spans - observed_spans)

        if prediction.get("latencyMs") is not None:
            latency_values.append(float(prediction["latencyMs"]))
        if prediction.get("apiError"):
            api_errors += 1
        if prediction.get("fallbackReason"):
            fallback_counts[str(prediction["fallbackReason"])] += 1
        if prediction.get("schemaValidAfterRetry"):
            schema_valid_after_retry += 1

    precision_denominator = true_positive + false_positive
    recall_denominator = true_positive + false_negative
    return {
        "items": len(annotations),
        "predictions": prediction_count,
        "totalSugarMae": round(sum(sugar_abs_errors) / len(sugar_abs_errors), 3) if sugar_abs_errors else None,
        "exactMatchRate": {
            field: round(exact_counts[field] / exact_totals[field], 3) if exact_totals[field] else None
            for field in NUMERIC_FIELDS
        },
        "sugarAliasPrecision": round(true_positive / precision_denominator, 3) if precision_denominator else None,
        "sugarAliasRecall": round(true_positive / recall_denominator, 3) if recall_denominator else None,
        "schemaValidAfterRetryRate": round(schema_valid_after_retry / prediction_count, 3) if prediction_count else None,
        "p95LatencyMs": percentile(latency_values, 95),
        "apiErrors": api_errors,
        "fallbackCounts": dict(fallback_counts),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute Sugar pAI development benchmark metrics.")
    parser.add_argument("--annotations", required=True, type=Path)
    parser.add_argument("--predictions", required=True, type=Path)
    args = parser.parse_args()
    metrics = compute_metrics(load_rows(args.annotations), load_rows(args.predictions))
    print(json.dumps(metrics, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

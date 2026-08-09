from pathlib import Path

from app.benchmark import compute_metrics, load_rows
from app.gi_data import find_sourced_gi, load_gi_records


FIXTURES = Path(__file__).resolve().parents[2] / "research" / "fixtures"


def test_benchmark_metrics_smoke():
    annotations = load_rows(FIXTURES / "synthetic_benchmark.json")
    predictions = load_rows(FIXTURES / "synthetic_predictions.json")
    metrics = compute_metrics(annotations, predictions)

    assert metrics["items"] == 2
    assert metrics["totalSugarMae"] == 0
    assert metrics["exactMatchRate"]["totalSugars"] == 1
    assert metrics["sugarAliasPrecision"] == 1
    assert metrics["sugarAliasRecall"] == 1
    assert metrics["schemaValidAfterRetryRate"] == 1
    assert metrics["p95LatencyMs"] == 5100


def test_synthetic_gi_fixture_does_not_create_sourced_matches():
    records = load_gi_records()
    assert records
    assert find_sourced_gi("synthetic sucrose demo", records) is None

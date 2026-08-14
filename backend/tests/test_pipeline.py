import asyncio
import sqlite3
from pathlib import Path

from app.db.ingest_off import ingest_off_csv
from app.db.off_products import lookup_local_off_product
from app.extraction import ExtractedLabel, ExtractionResult
from app.pipeline import (
    AnalysisJob,
    MethodExtractionOutcome,
    build_analysis_diagnostics,
    result_from_database,
    result_from_extraction,
    run_pipeline,
)

CSV_PATH = Path(__file__).resolve().parents[2] / "research" / "openfoodfacts_export.csv"


def make_job(tmp_path, image_paths=None):
    return AnalysisJob(
        analysis_id="analysis-test",
        market="PH",
        temp_dir=tmp_path,
        image_paths=image_paths or {"nutrition": tmp_path / "nutrition.jpg"},
        quality_checks=[],
        barcode=None,
    )


def make_extraction(label, model="gemma4:12b"):
    return ExtractionResult(
        label=label,
        model=model,
        attempts=1,
        latency_ms=100,
        token_counts={},
        validation_failures=[],
    )


def test_result_from_extraction_rejects_impossible_sugar_arithmetic(tmp_path):
    job = make_job(tmp_path)
    extraction = make_extraction(
        ExtractedLabel(
            total_carbohydrate=10,
            fiber=2,
            total_sugars=12,
            raw_ingredients="Oats, sugar",
            confidence=0.8,
        ),
    )

    try:
        result_from_extraction(job, extraction, None, None, ["Ollama gemma4:12b"])
    except ValueError as exc:
        assert "Total sugars cannot exceed total carbohydrate" in str(exc)
    else:
        raise AssertionError("Impossible extracted nutrition values should be rejected.")


def test_successful_extraction_includes_vision_diagnostics(tmp_path):
    job = make_job(
        tmp_path,
        {
            "nutrition": tmp_path / "nutrition.jpg",
            "ingredients": tmp_path / "ingredients.jpg",
        },
    )
    extraction = make_extraction(
        ExtractedLabel(
            product_name="Test cereal",
            total_carbohydrate=20,
            total_sugars=7,
            protein=3,
            raw_ingredients="oats, sugar, salt",
            confidence=0.76,
        ),
        model="local-vision-model",
    )
    outcome = MethodExtractionOutcome(
        status="complete",
        extraction=extraction,
        image_panels=["nutrition", "ingredients"],
    )
    diagnostics = build_analysis_diagnostics(job, vlm=outcome)

    result = result_from_extraction(job, extraction, None, None, ["Ollama local-vision-model"], diagnostics)

    assert result.diagnostics is not None
    assert result.diagnostics.vision_model == "local-vision-model"
    assert result.diagnostics.extraction_status == "complete"
    assert result.diagnostics.panels.ingredients.status == "complete"
    assert result.diagnostics.vlm.status == "complete"
    assert result.raw_ingredients.status == "Read from label"


def test_vlm_failure_diagnostics_keep_fields_unavailable(tmp_path):
    job = make_job(tmp_path)
    outcome = MethodExtractionOutcome(
        status="failed",
        failure_reason="Ollama vision extraction request failed: 401 Unauthorized",
        image_panels=["nutrition"],
    )
    diagnostics = build_analysis_diagnostics(job, vlm=outcome)

    result = result_from_database(job, None, None, [], diagnostics)

    assert result.diagnostics is not None
    assert result.diagnostics.extraction_status == "failed"
    assert "401 Unauthorized" in result.diagnostics.fallback_reason
    assert result.diagnostics.vlm.status == "failed"
    assert result.nutrients.total_carbohydrate.value is None
    assert result.raw_ingredients.value is None


def test_complete_local_barcode_skips_vlm(tmp_path, monkeypatch):
    db_path = tmp_path / "off.db"
    ingest_off_csv(CSV_PATH, db_path)
    monkeypatch.setenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "true")
    monkeypatch.setenv("SUGAR_PAI_OFF_DB_PATH", str(db_path))

    async def fail_extract(_image_paths):
        raise AssertionError("VLM should be skipped for a complete local database match.")

    monkeypatch.setattr("app.pipeline.extract_label_fields_from_images", fail_extract)
    job = AnalysisJob(
        analysis_id="complete-local",
        market="PH",
        temp_dir=tmp_path,
        image_paths={"nutrition": tmp_path / "nutrition.jpg"},
        quality_checks=[],
        barcode="4800361403764",
    )

    asyncio.run(run_pipeline(job))

    assert job.done is True
    assert job.result is not None
    assert job.result.status == "ready"
    assert job.result.diagnostics.extraction_status == "skipped"
    assert job.result.product.name.status == "Database match"
    assert job.result.provenance.external_processors == ["Open Food Facts local"]
    assert job.result.external_metadata is not None
    assert job.result.external_metadata.nova_group == "4 - Ultra processed food and drink products"
    assert job.result.external_metadata.source_name == "Open Food Facts"


def test_partial_local_barcode_runs_vlm_and_keeps_database_fallbacks(tmp_path, monkeypatch):
    db_path = tmp_path / "off.db"
    ingest_off_csv(CSV_PATH, db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute("UPDATE off_ph_products SET total_sugars_g = NULL WHERE code = '4800361403764'")
    monkeypatch.setenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "true")
    monkeypatch.setenv("SUGAR_PAI_OFF_DB_PATH", str(db_path))

    called = False

    async def fake_extract(_image_paths):
        nonlocal called
        called = True
        return ExtractionResult(
            label=ExtractedLabel(
                total_sugars=9.6,
                confidence=0.8,
            ),
            model="gemma4:12b",
            attempts=1,
            latency_ms=42,
            token_counts={},
            validation_failures=[],
        )

    monkeypatch.setattr("app.pipeline.extract_label_fields_from_images", fake_extract)
    job = AnalysisJob(
        analysis_id="partial-local",
        market="PH",
        temp_dir=tmp_path,
        image_paths={"nutrition": tmp_path / "nutrition.jpg"},
        quality_checks=[],
        barcode="4800361403764",
    )

    asyncio.run(run_pipeline(job))

    assert called is True
    assert job.result is not None
    assert job.result.nutrients.total_carbohydrate.source_kind == "database"
    assert job.result.nutrients.total_sugars.source_kind == "label"
    assert job.result.product.name.value == "nescafe original 20g"
    assert job.result.external_metadata is not None
    assert job.result.external_metadata.nova_groups_tags == "en:4-ultra-processed-food-and-drink-products"


def test_off_ingredients_produce_sugar_variants(tmp_path, monkeypatch):
    db_path = tmp_path / "off.db"
    ingest_off_csv(CSV_PATH, db_path)
    monkeypatch.setenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "true")
    monkeypatch.setenv("SUGAR_PAI_OFF_DB_PATH", str(db_path))
    lookup = lookup_local_off_product("4800361403764")
    job = make_job(tmp_path)
    job.barcode = "4800361403764"

    result = result_from_database(job, lookup.product, lookup.source_url, ["Open Food Facts local"])

    assert [variant.canonical_name for variant in result.sugar_variants] == [
        "Sucrose",
        "Glucose syrup",
        "Maltodextrin",
        "Acesulfame potassium",
    ]
    assert result.raw_ingredients.source_kind == "database"

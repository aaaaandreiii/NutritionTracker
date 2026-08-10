from app.extraction import ExtractedLabel, ExtractionResult
from app.pipeline import (
    AnalysisJob,
    MethodExtractionOutcome,
    build_analysis_diagnostics,
    result_from_database,
    result_from_extraction,
)


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

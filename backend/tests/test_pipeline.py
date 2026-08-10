from app.extraction import ExtractedLabel, ExtractionResult
from app.ocr import OcrResult
from app.pipeline import (
    AnalysisJob,
    MethodExtractionOutcome,
    build_analysis_diagnostics,
    result_from_database,
    result_from_extraction,
    result_from_extraction_comparison,
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


def test_result_from_extraction_rejects_impossible_sugar_arithmetic(tmp_path):
    job = make_job(tmp_path)
    extraction = ExtractionResult(
        label=ExtractedLabel(
            total_carbohydrate=10,
            fiber=2,
            total_sugars=12,
            raw_ingredients="Oats, sugar",
            confidence=0.8,
        ),
        model="qwen2.5:latest",
        attempts=1,
        latency_ms=100,
        token_counts={},
        validation_failures=[],
    )

    try:
        result_from_extraction(job, extraction, None, None, ["Tesseract OCR"])
    except ValueError as exc:
        assert "Total sugars cannot exceed total carbohydrate" in str(exc)
    else:
        raise AssertionError("Impossible extracted nutrition values should be rejected.")


def test_successful_extraction_includes_ocr_and_model_diagnostics(tmp_path):
    job = make_job(
        tmp_path,
        {
            "nutrition": tmp_path / "nutrition.jpg",
            "ingredients": tmp_path / "ingredients.jpg",
        },
    )
    ocr = OcrResult(
        provider="tesseract",
        text_by_panel={
            "nutrition": "Nutrition Facts\nTotal Carbohydrate 20g\nTotal Sugars 7g\nProtein 3g",
            "ingredients": "Ingredients: oats, sugar, salt",
        },
        latency_ms=50,
    )
    extraction = ExtractionResult(
        label=ExtractedLabel(
            product_name="Test cereal",
            total_carbohydrate=20,
            total_sugars=7,
            protein=3,
            raw_ingredients="oats, sugar, salt",
            confidence=0.76,
        ),
        model="local-test-model",
        attempts=1,
        latency_ms=100,
        token_counts={},
        validation_failures=[],
    )
    diagnostics = build_analysis_diagnostics(job, ocr_result=ocr, extraction=extraction)

    result = result_from_extraction(job, extraction, None, None, ["Tesseract OCR"], diagnostics)

    assert result.diagnostics is not None
    assert result.diagnostics.ocr_provider == "tesseract"
    assert result.diagnostics.ocr_status == "complete"
    assert result.diagnostics.llm_model == "local-test-model"
    assert result.diagnostics.extraction_status == "complete"
    assert result.diagnostics.panels.ingredients.readable_characters > 0
    assert result.raw_ingredients.status == "Read from label"


def test_llm_failure_diagnostics_keep_fields_unavailable(tmp_path):
    job = make_job(tmp_path)
    ocr = OcrResult(
        provider="tesseract",
        text_by_panel={"nutrition": "Nutrition Facts\nTotal Carbohydrate 20g\nTotal Sugars 7g"},
        latency_ms=50,
    )
    diagnostics = build_analysis_diagnostics(
        job,
        ocr_result=ocr,
        fallback_reason="Ollama extraction request failed: 401 Unauthorized",
    )

    result = result_from_database(job, None, None, ["Tesseract OCR"], diagnostics)

    assert result.diagnostics is not None
    assert result.diagnostics.ocr_status == "complete"
    assert result.diagnostics.extraction_status == "failed"
    assert "401 Unauthorized" in result.diagnostics.fallback_reason
    assert result.nutrients.total_carbohydrate.value is None
    assert result.raw_ingredients.value is None


def test_ocr_failure_diagnostics_mark_extraction_skipped(tmp_path):
    job = make_job(tmp_path)
    diagnostics = build_analysis_diagnostics(
        job,
        fallback_reason="Tesseract OCR provider selected but the tesseract binary is not installed.",
    )

    result = result_from_database(job, None, None, [], diagnostics)

    assert result.diagnostics is not None
    assert result.diagnostics.ocr_provider == "tesseract"
    assert result.diagnostics.ocr_status == "failed"
    assert result.diagnostics.extraction_status == "skipped"
    assert result.diagnostics.panels.nutrition.status == "failed"


def make_outcome(source, label, model):
    return MethodExtractionOutcome(
        source=source,
        status="complete",
        extraction=ExtractionResult(
            label=label,
            model=model,
            attempts=1,
            latency_ms=100,
            token_counts={},
            validation_failures=[],
            source=source,
        ),
        image_panels=["nutrition"],
    )


def test_comparison_prefills_only_matching_valid_values(tmp_path):
    job = make_job(tmp_path)
    ocr = OcrResult(
        provider="tesseract",
        text_by_panel={"nutrition": "Nutrition Facts\nTotal Carbohydrate 20g\nTotal Sugars 7g"},
        latency_ms=50,
    )
    label = ExtractedLabel(
        product_name="Test cereal",
        total_carbohydrate=20,
        total_sugars=7,
        confidence=0.8,
    )
    ocr_outcome = make_outcome("ocr_llm", label, "qwen2.5:latest")
    vlm_outcome = make_outcome("vlm", label, "gemma4:12b")

    result = result_from_extraction_comparison(
        job,
        ocr_outcome,
        vlm_outcome,
        ocr,
        None,
        None,
        ["Tesseract OCR", "Ollama qwen2.5:latest", "Ollama gemma4:12b"],
    )

    assert result.product.name.value == "Test cereal"
    assert result.nutrients.total_carbohydrate.value == 20
    assert result.nutrients.total_carbohydrate.status == "Read from label"
    assert result.field_comparisons["totalCarbohydrate"].agreement_status == "agree"
    assert result.field_comparisons["totalCarbohydrate"].prefilled is True
    assert result.extraction_candidates["totalCarbohydrate"][0].source == "ocr_llm"


def test_comparison_keeps_conflicting_values_blank(tmp_path):
    job = make_job(tmp_path)
    ocr = OcrResult(
        provider="tesseract",
        text_by_panel={"nutrition": "Nutrition Facts\nTotal Carbohydrate 20g\nTotal Sugars 7g"},
        latency_ms=50,
    )
    ocr_outcome = make_outcome(
        "ocr_llm",
        ExtractedLabel(total_carbohydrate=20, total_sugars=7, confidence=0.8),
        "qwen2.5:latest",
    )
    vlm_outcome = make_outcome(
        "vlm",
        ExtractedLabel(total_carbohydrate=20, total_sugars=8, confidence=0.7),
        "gemma4:12b",
    )

    result = result_from_extraction_comparison(job, ocr_outcome, vlm_outcome, ocr, None, None, [])

    assert result.nutrients.total_carbohydrate.value == 20
    assert result.nutrients.total_sugars.value is None
    assert result.nutrients.total_sugars.status == "Conflict"
    assert result.nutrients.total_sugars.conflict is True
    assert result.field_comparisons["totalSugars"].agreement_status == "conflict"
    assert len(result.extraction_candidates["totalSugars"]) == 2
    assert result.retake_recommended is True


def test_single_method_candidates_are_not_prefilled(tmp_path):
    job = make_job(tmp_path)
    job.extraction_mode = "ocr_llm"
    ocr = OcrResult(
        provider="tesseract",
        text_by_panel={"nutrition": "Nutrition Facts\nTotal Carbohydrate 20g"},
        latency_ms=50,
    )
    ocr_outcome = make_outcome(
        "ocr_llm",
        ExtractedLabel(total_carbohydrate=20, confidence=0.8),
        "qwen2.5:latest",
    )

    result = result_from_extraction_comparison(job, ocr_outcome, None, ocr, None, None, [])

    assert result.nutrients.total_carbohydrate.value is None
    assert result.field_comparisons["totalCarbohydrate"].agreement_status == "ocr_only"
    assert result.field_comparisons["totalCarbohydrate"].prefilled is False
    assert result.extraction_candidates["totalCarbohydrate"][0].value == 20

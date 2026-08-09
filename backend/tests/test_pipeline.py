from app.extraction import ExtractedLabel, ExtractionResult
from app.pipeline import AnalysisJob, result_from_extraction


def test_result_from_extraction_rejects_impossible_sugar_arithmetic(tmp_path):
    job = AnalysisJob(
        analysis_id="analysis-test",
        market="PH",
        temp_dir=tmp_path,
        image_paths={"nutrition": tmp_path / "nutrition.jpg"},
        quality_checks=[],
        barcode=None,
    )
    extraction = ExtractionResult(
        label=ExtractedLabel(
            total_carbohydrate=10,
            fiber=2,
            total_sugars=12,
            raw_ingredients="Oats, sugar",
            confidence=0.8,
        ),
        model="deepseek-v4-flash:cloud",
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

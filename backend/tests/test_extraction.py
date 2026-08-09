import pytest
from pydantic import ValidationError

from app.extraction import ExtractedLabel, _parse_json_object
from app.ocr import OcrProviderError, configured_ocr_provider


def test_parse_json_object_accepts_fenced_json_only_for_object():
    parsed = _parse_json_object('```json\n{"total_carbohydrate": 22, "fiber": 3}\n```')
    assert parsed == {"total_carbohydrate": 22, "fiber": 3}

    with pytest.raises(ValueError):
        _parse_json_object("not json")


def test_extracted_label_rejects_extra_fields_and_blanks_become_none():
    label = ExtractedLabel.model_validate({"product_name": "", "total_sugars": 4})
    assert label.product_name is None
    assert label.total_sugars == 4

    with pytest.raises(ValidationError):
        ExtractedLabel.model_validate({"total_sugars": 4, "medical_advice": "safe for diabetes"})


def test_invalid_ocr_provider_is_a_clear_configuration_error(monkeypatch):
    monkeypatch.setenv("SUGAR_PAI_OCR_PROVIDER", "vision")
    with pytest.raises(OcrProviderError, match="tesseract"):
        configured_ocr_provider()

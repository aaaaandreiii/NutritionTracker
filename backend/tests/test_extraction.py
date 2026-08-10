import asyncio
from base64 import b64encode

import httpx
import pytest
from pydantic import ValidationError

from app.extraction import ExtractedLabel, LabelExtractionError, _parse_json_object, extract_label_fields_from_images


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


def test_vlm_extraction_sends_base64_images_to_ollama_generate(monkeypatch, tmp_path):
    image_path = tmp_path / "nutrition.jpg"
    image_path.write_bytes(b"sanitized image bytes")
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "response": '{"product_name":"Test cereal","total_carbohydrate":20,"total_sugars":7,"notes":["visible nutrition panel"]}',
                "prompt_eval_count": 11,
                "eval_count": 22,
            }

    class FakeClient:
        def __init__(self, timeout):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, json):
            captured["url"] = url
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setenv("OLLAMA_BASE_URL", "https://ollama.example.test/")
    monkeypatch.setenv("SUGAR_PAI_VISION_MODEL", "gemma4:12b")
    monkeypatch.setenv("SUGAR_PAI_VISION_TIMEOUT_SECONDS", "45")
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", FakeClient)

    result = asyncio.run(extract_label_fields_from_images({"nutrition": image_path}))

    assert result.source == "vlm"
    assert result.model == "gemma4:12b"
    assert result.label.product_name == "Test cereal"
    assert captured["timeout"] == 45
    assert captured["url"] == "https://ollama.example.test/api/generate"
    assert captured["payload"]["model"] == "gemma4:12b"
    assert captured["payload"]["stream"] is False
    assert captured["payload"]["images"] == [b64encode(b"sanitized image bytes").decode("ascii")]


def test_vlm_timeout_message_names_timeout(monkeypatch, tmp_path):
    image_path = tmp_path / "nutrition.jpg"
    image_path.write_bytes(b"sanitized image bytes")

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            raise httpx.ReadTimeout("")

    monkeypatch.setenv("SUGAR_PAI_VISION_TIMEOUT_SECONDS", "61")
    monkeypatch.setattr("app.extraction.httpx.AsyncClient", FakeClient)

    with pytest.raises(LabelExtractionError, match="timed out after 61s"):
        asyncio.run(extract_label_fields_from_images({"nutrition": image_path}))

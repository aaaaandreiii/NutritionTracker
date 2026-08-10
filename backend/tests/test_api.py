from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.extraction import ExtractedLabel, ExtractionResult
from app.main import app


def readable_test_image() -> bytes:
    image = Image.new("RGB", (1000, 1400), "#ddd8c9")
    draw = ImageDraw.Draw(image)
    for y in range(80, 1320, 34):
        draw.rectangle((90, y, 900, y + 12), fill="#26352e")
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def test_analysis_events_finalize_and_delete_round_trip(monkeypatch):
    async def fake_extract(_image_paths):
        return ExtractionResult(
            label=ExtractedLabel(
                product_name="Test cereal",
                serving_size=30,
                serving_unit="g",
                total_carbohydrate=22,
                fiber=3,
                total_sugars=7,
                protein=4,
                fat=2,
                raw_ingredients="Oats, asukal, salt",
                confidence=0.84,
            ),
            model="gemma4:12b",
            attempts=1,
            latency_ms=100,
            token_counts={},
            validation_failures=[],
        )

    monkeypatch.setattr("app.pipeline.extract_label_fields_from_images", fake_extract)

    with TestClient(app) as client:
        created = client.post(
            "/api/v1/analyses",
            data={"market": "PH"},
            files={"nutrition_image": ("nutrition.jpg", readable_test_image(), "image/jpeg")},
        )
        assert created.status_code == 202, created.text
        analysis_id = created.json()["analysisId"]

        events = client.get(f"/api/v1/analyses/{analysis_id}/events")
        assert events.status_code == 200
        assert '"type":"result"' in events.text
        assert "Vision fields assembled for manual review" in events.text
        assert '"diagnostics"' in events.text
        assert '"extractionStatus":"complete"' in events.text

        finalized = client.post(
            f"/api/v1/analyses/{analysis_id}/finalize",
            json={
                "productName": "Test cereal",
                "servingSize": 30,
                "servingUnit": "g",
                "nutrients": {
                    "totalCarbohydrate": 22,
                    "fiber": 3,
                    "totalSugars": 7,
                    "addedSugars": None,
                    "sugarAlcohols": None,
                    "protein": 4,
                    "fat": 2,
                },
                "rawIngredients": "Oats, asukal, salt",
                "consumedServings": 1.5,
            },
        )
        assert finalized.status_code == 200, finalized.text
        result = finalized.json()
        assert result["status"] == "confirmed"
        assert result["diagnostics"]["extractionStatus"] == "complete"
        assert result["diagnostics"]["vlm"]["status"] == "complete"
        assert result["nutrients"]["addedSugars"]["value"] is None
        assert result["nutrients"]["addedSugars"]["status"] == "Unavailable"
        assert result["glycemic"]["status"] == "heuristic_demo"
        assert result["glycemic"]["gl"] == 12.4
        assert result["glycemic"]["glBand"] == "yellow"
        assert result["sugarVariants"][0]["canonicalName"] == "Sucrose"

        deleted = client.delete(f"/api/v1/analyses/{analysis_id}")
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/analyses/{analysis_id}/events").status_code == 404

from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

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
    monkeypatch.setenv("SUGAR_PAI_OCR_PROVIDER", "invalid")
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
        assert "Live extraction unavailable" in events.text

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
        assert result["nutrients"]["addedSugars"]["value"] is None
        assert result["nutrients"]["addedSugars"]["status"] == "Unavailable"
        assert result["glycemic"]["status"] == "heuristic_demo"
        assert result["glycemic"]["gl"] == 12.4
        assert result["glycemic"]["glBand"] == "yellow"
        assert result["sugarVariants"][0]["canonicalName"] == "Sucrose"

        deleted = client.delete(f"/api/v1/analyses/{analysis_id}")
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/analyses/{analysis_id}/events").status_code == 404

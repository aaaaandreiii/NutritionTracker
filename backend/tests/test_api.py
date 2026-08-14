import json
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.db.ingest_off import ingest_off_csv
from app.extraction import ExtractedLabel, ExtractionResult
from app.main import app


CSV_PATH = Path(__file__).resolve().parents[2] / "research" / "openfoodfacts_export.csv"


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


def test_label_record_validation_does_not_require_live_analysis_job():
    payload = {
        "productName": "Edited cereal",
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
        "consumedServings": 2,
    }

    with TestClient(app) as client:
        response = client.post("/api/v1/label-records/validate", json=payload)
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["status"] == "confirmed"
        assert result["productName"]["value"] == "Edited cereal"
        assert result["nutrients"]["totalCarbohydrate"]["status"] == "User confirmed"
        assert result["sugarVariants"][0]["canonicalName"] == "Sucrose"
        assert result["glycemic"]["status"] == "heuristic_demo"
        assert result["glycemic"]["gl"] == 12.4
        assert result["validationChecks"][0]["status"] == "pass"


def test_label_record_validation_computes_demo_gl_for_whole_oats_without_sugar_alias():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/label-records/validate",
            json={
                "productName": "Quaker Rolled Oatmeal",
                "servingSize": 20,
                "servingUnit": "g",
                "nutrients": {
                    "totalCarbohydrate": 4,
                    "fiber": 2.3,
                    "totalSugars": 0.4,
                    "addedSugars": None,
                    "sugarAlcohols": None,
                    "protein": 4.9,
                    "fat": None,
                },
                "rawIngredients": "Whole Grain Oats",
                "consumedServings": 1,
            },
        )

    assert response.status_code == 200, response.text
    result = response.json()
    assert result["sugarVariants"] == []
    assert result["glycemic"]["status"] == "heuristic_demo"
    assert result["glycemic"]["matchLevel"] == "same_food_form"
    assert result["glycemic"]["gl"] == 0.9
    assert result["glycemic"]["glBand"] == "green"


def test_label_record_validation_rejects_impossible_nutrition_math():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/label-records/validate",
            json={
                "productName": "Impossible bar",
                "servingSize": 40,
                "servingUnit": "g",
                "nutrients": {
                    "totalCarbohydrate": 10,
                    "fiber": 2,
                    "totalSugars": 6,
                    "addedSugars": 9,
                    "sugarAlcohols": None,
                    "protein": 4,
                    "fat": 3,
                },
                "rawIngredients": "Oats, sugar",
                "consumedServings": 1,
            },
        )

    assert response.status_code == 422
    assert "Added sugars cannot exceed total sugars" in response.json()["detail"]


def test_barcode_only_analysis_can_be_finalized(tmp_path, monkeypatch):
    db_path = tmp_path / "off.db"
    ingest_off_csv(CSV_PATH, db_path)
    monkeypatch.setenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "true")
    monkeypatch.setenv("SUGAR_PAI_OFF_DB_PATH", str(db_path))

    with TestClient(app) as client:
        created = client.post(
            "/api/v1/analyses/barcode",
            json={"barcode": "4800361403764", "market": "PH"},
        )
        assert created.status_code == 201, created.text
        payload = created.json()
        result = payload["result"]
        assert result["status"] == "ready"
        assert result["product"]["name"]["status"] == "Database match"
        assert result["rawIngredients"]["status"] == "Database match"
        assert result["diagnostics"]["extractionStatus"] == "skipped"
        assert payload["analysisId"] == result["analysisId"]

        finalized = client.post(
            f"/api/v1/analyses/{payload['analysisId']}/finalize",
            json={
                "productName": result["product"]["name"]["value"],
                "servingSize": result["serving"]["size"]["value"],
                "servingUnit": result["serving"]["unit"],
                "nutrients": {
                    "totalCarbohydrate": result["nutrients"]["totalCarbohydrate"]["value"],
                    "fiber": result["nutrients"]["fiber"]["value"],
                    "totalSugars": result["nutrients"]["totalSugars"]["value"],
                    "addedSugars": result["nutrients"]["addedSugars"]["value"],
                    "sugarAlcohols": result["nutrients"]["sugarAlcohols"]["value"],
                    "protein": result["nutrients"]["protein"]["value"],
                    "fat": result["nutrients"]["fat"]["value"],
                },
                "rawIngredients": result["rawIngredients"]["value"],
                "consumedServings": 1,
            },
        )
        assert finalized.status_code == 200, finalized.text
        assert finalized.json()["status"] == "confirmed"


def test_barcode_only_analysis_accepts_upc_a_alias(tmp_path, monkeypatch):
    db_path = tmp_path / "off.db"
    ingest_off_csv(CSV_PATH, db_path)
    monkeypatch.setenv("SUGAR_PAI_ENABLE_OFF_LOOKUP", "true")
    monkeypatch.setenv("SUGAR_PAI_OFF_DB_PATH", str(db_path))

    with TestClient(app) as client:
        lookup = client.get("/api/v1/off-products/750515018402?market=PH")
        assert lookup.status_code == 200, lookup.text
        lookup_payload = lookup.json()
        assert lookup_payload["status"] == "found"
        assert lookup_payload["complete"] is True
        assert lookup_payload["barcode"] == "0750515018402"
        assert lookup_payload["product"]["productName"] == "sky flakes 25g"

        created = client.post(
            "/api/v1/analyses/barcode",
            json={"barcode": "750515018402", "market": "PH"},
        )
        assert created.status_code == 201, created.text
        result = created.json()["result"]
        assert result["product"]["barcode"]["value"] == "0750515018402"
        assert result["product"]["name"]["value"] == "sky flakes 25g"


def test_unlabeled_food_catalog_lists_curated_ph_demo_foods():
    with TestClient(app) as client:
        response = client.get("/api/v1/unlabeled-foods/catalog?market=PH")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["market"] == "PH"
    assert any(food["foodId"] == "ph_kanin_white_rice" for food in payload["foods"])
    assert any(food["foodId"] == "ph_boiled_egg" for food in payload["foods"])
    assert any(food["foodId"] == "ph_ginisang_monggo" for food in payload["foods"])
    assert any("qualitative demo" in item for item in payload["limitations"])
    assert all("gi" not in food and "gl" not in food for food in payload["foods"])


def test_unlabeled_food_identify_uses_demo_alias_hint_from_filename():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/unlabeled-foods/identify",
            data={"market": "PH"},
            files={"food_image": ("kanin-photo.jpg", readable_test_image(), "image/jpeg")},
        )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["method"] == "filename_alias_demo"
    assert payload["candidates"][0]["foodId"] == "ph_kanin_white_rice"
    assert payload["candidates"][0]["confidence"] is not None


def test_unlabeled_food_identify_falls_back_to_manual_catalog_selection():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/unlabeled-foods/identify",
            data={"market": "PH"},
            files={"food_image": ("unknown-food.jpg", readable_test_image(), "image/jpeg")},
        )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["method"] == "manual_catalog_fallback"
    assert payload["candidates"] == []
    assert "Choose the food manually" in payload["message"]


def test_unlabeled_food_record_validation_returns_context_only_record_without_numeric_gi_or_gl():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/unlabeled-food-records/validate",
            json={
                "market": "PH",
                "foodId": "ph_pandesal",
                "portionLabel": "1 piece",
                "notes": "bakery sample",
            },
        )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["kind"] == "curated_unlabeled_demo"
    assert payload["status"] == "confirmed"
    assert payload["displayName"] == "Pandesal"
    assert payload["selectedPortionLabel"] == "1 piece"
    assert payload["notes"] == "bakery sample"
    assert payload["contextFlags"]
    assert {flag["category"] for flag in payload["contextFlags"]} == {"curated_demo"}
    assert payload["glycemic"]["status"] == "unavailable"
    assert payload["glycemic"]["gi"] is None
    assert payload["glycemic"]["gl"] is None
    assert payload["glycemic"]["glBand"] is None
    assert any("does not provide authoritative calories, macros, GI, GL, or FNRI" in item for item in payload["limitations"])


def test_unlabeled_food_record_validation_rejects_unknown_food_and_portion():
    with TestClient(app) as client:
        unknown_food = client.post(
            "/api/v1/unlabeled-food-records/validate",
            json={"market": "PH", "foodId": "ph_unknown", "portionLabel": "1 piece"},
        )
        bad_portion = client.post(
            "/api/v1/unlabeled-food-records/validate",
            json={"market": "PH", "foodId": "ph_pandesal", "portionLabel": "1 cup"},
        )

    assert unknown_food.status_code == 404
    assert "not found" in unknown_food.json()["detail"]
    assert bad_portion.status_code == 422
    assert "Portion label" in bad_portion.json()["detail"]


def test_manual_estimated_meal_can_finalize_as_context_only_without_usda_key(monkeypatch):
    monkeypatch.delenv("USDA_FDC_API_KEY", raising=False)
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/unlabeled-meal-analyses",
            data={"market": "PH", "description": "pandesal"},
        )
        assert created.status_code == 202, created.text
        analysis_id = created.json()["analysisId"]
        with client.stream("GET", f"/api/v1/unlabeled-meal-analyses/{analysis_id}/events") as stream:
            body = "".join(stream.iter_text())
        result_event = next(
            json.loads(line[6:]) for line in body.splitlines()
            if line.startswith("data: ") and '"type":"result"' in line
        )
        component = result_event["result"]["components"][0]

        finalized = client.post(
            f"/api/v1/unlabeled-meal-analyses/{analysis_id}/finalize",
            json={
                "mealName": "Pandesal snack",
                "meal": "Snack",
                "components": [{
                    "componentId": component["componentId"],
                    "confirmedName": "Pandesal",
                    "fdcId": None,
                    "householdPortion": "1 piece",
                    "gramRange": {"minimum": 35, "maximum": 55, "unit": "g"},
                    "contextOnly": True,
                    "qualitativeTags": component["qualitativeTags"],
                }],
            },
        )

    assert finalized.status_code == 200, finalized.text
    payload = finalized.json()
    assert payload["kind"] == "estimated_unlabeled_meal"
    assert payload["partial"] is True
    assert payload["excludedComponentCount"] == 1
    assert payload["aggregateNutrientRanges"]["totalCarbohydrate"] is None


def test_food_data_search_and_smart_context_have_deterministic_fallbacks_without_optional_keys(monkeypatch):
    monkeypatch.delenv("USDA_FDC_API_KEY", raising=False)
    monkeypatch.setenv("SUGAR_PAI_SMART_CONTEXT_WRITER", "false")
    with TestClient(app) as client:
        search = client.get("/api/v1/food-data/search?q=white%20rice")
        context = client.post("/api/v1/smart-context/resolve", json={
            "kind": "estimated_unlabeled_meal",
            "displayName": "White rice",
            "market": "PH",
            "meal": "Lunch",
            "nutrients": {
                "totalCarbohydrate": {"range": {"minimum": 20, "maximum": 40, "unit": "g"}, "evidenceType": "derived"},
                "fiber": {"range": {"minimum": 0.5, "maximum": 2, "unit": "g"}, "evidenceType": "derived"},
            },
            "qualitativeTags": ["rice"],
            "excludedComponentCount": 0,
        })

    assert search.status_code == 200
    assert search.json()["available"] is False
    assert context.status_code == 200, context.text
    assert context.json()["generationMode"] == "deterministic"
    assert "fiber-anchor" in context.json()["triggeredRuleIds"]

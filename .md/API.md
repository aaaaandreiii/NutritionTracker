# API Documentation

The FastAPI backend exposes short-lived packaged-label analysis jobs, stateless label validation, and curated unlabeled-food demo endpoints.

## General Notes

- Base URL in development: `http://localhost:8000`
- OpenAPI docs: `/docs`
- Response field names are camelCase.
- Uploaded images are limited to 8 MB each.
- Backend analysis jobs are in-memory and expire after 15 minutes.

## Endpoints

### Health Check

`GET /health`

Returns:

```json
{ "status": "ok" }
```

### Create Packaged-Label Analysis

`POST /api/v1/analyses`

Content type: `multipart/form-data`

Fields:
- `nutrition_image` file, required
- `market` enum, required: `PH` or `US`
- `ingredient_image` file, optional
- `front_image` file, optional
- `barcode` numeric string, optional

Returns `202 Accepted`:

```json
{ "analysisId": "uuid-string", "expiresInSeconds": 900 }
```

Errors:
- `413`: image exceeds 8 MB
- `422`: invalid image or form value

### Stream Analysis Events

`GET /api/v1/analyses/{analysis_id}/events`

Streams Server-Sent Events. Event payloads include `stage`, `result`, and `error` event types. A successful stream ends with an `AnalysisResult`.

Errors:
- `404`: analysis ID is missing or expired

### Finalize Analysis

`POST /api/v1/analyses/{analysis_id}/finalize`

Content type: `application/json`

Payload: `FinalizeRequest`

Key fields:
- `productName`
- `servingSize`
- `servingUnit`
- `nutrients.totalCarbohydrate`
- `nutrients.fiber`
- `nutrients.totalSugars`
- `nutrients.addedSugars`
- `nutrients.sugarAlcohols`
- `nutrients.protein`
- `nutrients.fat`
- `rawIngredients`
- `consumedServings`

Returns confirmed `AnalysisResult`.

Errors:
- `409`: analysis is still processing
- `422`: deterministic validation failed

### Validate Label Record

`POST /api/v1/label-records/validate`

Runs deterministic packaged-label validation without a live analysis job.

Payload: `FinalizeRequest`

Returns `LabelRecordValidationResponse`.

### List Curated Unlabeled Foods

`GET /api/v1/unlabeled-foods/catalog?market=PH`

Returns `UnlabeledFoodCatalogResponse`:

```json
{
  "market": "PH",
  "foods": [
    {
      "foodId": "ph_pandesal",
      "displayName": "Pandesal",
      "market": "PH",
      "aliases": ["pandesal", "pan de sal", "bread roll", "filipino bread"],
      "portionLabels": ["1 piece", "2 pieces", "user-described portion"],
      "qualitativeTags": ["bread", "refined-grain context", "portion-sensitive"],
      "limitations": [],
      "matchReason": null,
      "confidence": null
    }
  ],
  "limitations": []
}
```

This response intentionally excludes calories, macros, GI, and GL.

### Identify Curated Unlabeled Food

`POST /api/v1/unlabeled-foods/identify`

Content type: `multipart/form-data`

Fields:
- `food_image` file, required
- `market` enum, required: `PH`

Returns `UnlabeledFoodIdentifyResponse` with candidate hints. If no candidate is found, `method` is `manual_catalog_fallback` and `candidates` is empty.

### Validate Curated Unlabeled Record

`POST /api/v1/unlabeled-food-records/validate`

Payload:

```json
{
  "market": "PH",
  "foodId": "ph_pandesal",
  "portionLabel": "1 piece",
  "notes": "optional preparation note"
}
```

Returns `CuratedFoodRecord` with:
- `kind: "curated_unlabeled_demo"`
- selected food and portion
- qualitative tags
- context flags
- `glycemic.status: "unavailable"`
- `glycemic.gi`, `glycemic.gl`, and `glycemic.glBand` as `null`
- limitations and provenance

Errors:
- `404`: unknown catalog food
- `422`: unsupported market, invalid image, or invalid portion for selected food

### Delete Analysis Job

`DELETE /api/v1/analyses/{analysis_id}`

Deletes an in-memory analysis job and temporary files.

Returns `204 No Content`.

# API Documentation

The FastAPI backend exposes short-lived packaged-label analysis jobs, local barcode lookup, stateless label validation, curated unlabeled-food demo endpoints, and evidence-grounded chat streaming. It stores no conversations.

## General Notes

- Base URL in development: `http://localhost:8000`
- OpenAPI docs: `/docs`
- Response field names are camelCase.
- Uploaded images are limited to 8 MB each.
- Backend analysis jobs are in-memory and expire after 15 minutes.
- Local Open Food Facts lookup is enabled with `SUGAR_PAI_ENABLE_OFF_LOOKUP=true` and reads `SUGAR_PAI_OFF_DB_PATH` or `backend/app/data/off_ph_products.db`.

## Endpoints

### Health Check

`GET /health`

Returns:

```json
{ "status": "ok" }
```

### Stream Evidence Chat

`POST /api/v1/chat/stream`

Content type: `application/json`; response type: `text/event-stream`. This uses POST-based SSE so the validated product context is not placed in a URL.

Request constraints:

- `question`: 1–2,000 characters
- `turns`: at most 10 prior `{ role, content }` messages
- `product`: optional minimal snapshot of one locally validated packaged-label record

The optional product contains its local log reference, product/serving identity, nullable nutrient values, ingredients, matched sugar-variant names, and explicit glycemic-evidence status. `null` continues to mean **Not declared / unavailable**, never zero.

Events are emitted in this order:

1. `stage` for safety and retrieval status
2. `sources`, always before answer text, with up to six stable/deduplicated sources
3. `stage` for generation
4. zero or more `delta` token events
5. `done`, or an `error` containing `code`, `message`, and `retryable`

Source snapshots include `id`, `index`, `type`, `relationship`, `strength`, `title`, `publisher`, `domain`, `url`, and a supporting excerpt. Safety refusals, out-of-scope answers, and no-evidence answers are deterministic and do not call the model. Model timeouts and availability failures are retryable. Tavily absence or failure falls back to curated-only retrieval.

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

### Lookup Local Open Food Facts Product

`GET /api/v1/off-products/{barcode}?market=PH`

Returns an `OffProductLookupResponse` from the generated local SQLite database. This endpoint does not contact the public Open Food Facts API.

Lookup is exact first, then tries equivalent UPC-A / zero-prefixed EAN-13 forms. For example, `750515018402` can resolve to canonical database barcode `0750515018402`.

Response statuses:
- `found`: barcode exists locally
- `not_found`: no local row
- `disabled`: `SUGAR_PAI_ENABLE_OFF_LOOKUP` is not `true`
- `db_missing`: the configured SQLite file is unavailable
- `unsupported_market`: only `PH` is bundled

Example response for a complete match:

```json
{
  "barcode": "4800361403764",
  "market": "PH",
  "status": "found",
  "complete": true,
  "missingFields": [],
  "product": {
    "barcode": "4800361403764",
    "productName": "nescafe original 20g",
    "brand": "Nestlé",
    "servingSize": 20,
    "servingUnit": "g",
    "servingBasis": "per database serving",
    "nutrients": {
      "totalCarbohydrate": 14,
      "fiber": 0.34,
      "totalSugars": 9.7,
      "addedSugars": null,
      "sugarAlcohols": null,
      "protein": 0.27,
      "fat": 3.4
    }
  },
  "ingredients": "Sugar, Coffee creamer...",
  "qualitativeMarkers": {
    "novaGroup": "4 - Ultra processed food and drink products",
    "nutriscoreGrade": null,
    "allergensTags": "en:milk"
  },
  "sourceUrl": "https://world.openfoodfacts.org/product/4800361403764",
  "sourceKind": "local_open_food_facts",
  "message": "A complete local Open Food Facts record is available for review."
}
```

### Create Barcode-Only Analysis

`POST /api/v1/analyses/barcode`

Creates an already-completed analysis job from a complete local Open Food Facts match. The returned `AnalysisResult` can be finalized through the normal finalize endpoint, so user confirmation remains required before logging. UPC-A / zero-prefixed EAN-13 aliases are resolved before evidence assembly.

Payload:

```json
{ "barcode": "4800361403764", "market": "PH" }
```

Returns `201 Created`:

```json
{
  "analysisId": "uuid-string",
  "expiresInSeconds": 900,
  "result": { "status": "ready" }
}
```

Errors:
- `404`: barcode is not in the local database
- `409`: local lookup is disabled
- `422`: unsupported market or local row is missing required nutrition fields
- `503`: local SQLite database is unavailable

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

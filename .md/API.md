# API Documentation

The FastAPI backend exposes short-lived packaged-label and estimated-meal jobs, local barcode lookup, USDA-backed food matching, stateless validation, backend Smart Context resolution, legacy curated-food fallbacks, and evidence-grounded chat streaming. It stores no conversations or durable meal records.

## General Notes

- Base URL in development: `http://localhost:8000`
- OpenAPI docs: `/docs`
- Response field names are camelCase.
- Uploaded images are limited to 8 MB each.
- Backend analysis jobs are in-memory and expire after 15 minutes. Estimated-meal files are also deleted immediately on finalize or explicit delete.
- Local Open Food Facts lookup is enabled with `SUGAR_PAI_ENABLE_OFF_LOOKUP=true` and reads `SUGAR_PAI_OFF_DB_PATH` or `backend/app/data/off_ph_products.db`.
- USDA FoodData Central calls require server-only `USDA_FDC_API_KEY`. Missing credentials return an explicit qualitative-fallback response.
- Optional Smart Context writing is disabled unless `SUGAR_PAI_SMART_CONTEXT_WRITER=true`; deterministic resolution is always available.

## Evidence Value Compatibility

Existing `EvidenceValue` fields remain compatible. Responses now also include:

```json
{
  "value": 14,
  "unit": "g",
  "sourceKind": "database",
  "status": "Database match",
  "evidenceType": "retrieved",
  "range": null,
  "confidenceBand": "medium",
  "evidenceTrail": [
    {
      "timestamp": "2026-08-14T00:00:00Z",
      "evidenceType": "retrieved",
      "sourceKind": "database",
      "sourceId": "local-open-food-facts",
      "note": "Retrieved from the exact local barcode match."
    }
  ],
  "source": {
    "sourceId": "local-open-food-facts",
    "name": "Local Open Food Facts snapshot",
    "url": "https://world.openfoodfacts.org/product/..."
  }
}
```

Allowed evidence types are `observed`, `retrieved`, `estimated`, `derived`, `contextual`, and `unavailable`. A numeric range uses `{ "minimum", "maximum", "unit" }`; its minimum must not exceed its maximum.

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

### Create Estimated Unlabeled-Meal Analysis

`POST /api/v1/unlabeled-meal-analyses`

Content type: `multipart/form-data`

Fields:
- `market`: currently `PH`
- `food_image`: optional JPEG, PNG, or WebP
- `description`: optional manual food name, maximum 250 characters

At least one of `food_image` or `description` is required. Returns `202 Accepted`:

```json
{ "analysisId": "uuid-string", "expiresInSeconds": 900 }
```

The image is sanitized and stripped of EXIF metadata before Ollama receives it. The meal model may return at most 12 components and is schema-prohibited from returning macros, calories, GI, GL, health claims, or glucose predictions.

Errors:
- `413`: image exceeds 8 MB
- `422`: missing input, unsupported market, or invalid image

### Stream Estimated-Meal Events

`GET /api/v1/unlabeled-meal-analyses/{analysis_id}/events`

Response type: `text/event-stream`.

Stages include `image_check`, `component_identification`, and `nutrition_matching`, followed by a `result` containing `EstimatedMealDraft` or an `error`. Draft components contain:

- `componentId`
- `identifiedName`
- visible `preparationClues`
- `householdPortion`
- `gramRange`
- numeric confidence and confidence band
- no more than five USDA candidates
- selected candidate ID when available
- `contextOnly`, qualitative tags, and source path

Vision or USDA failure is represented in `warnings`; the result remains usable for manual/context-only confirmation.

### Search USDA FoodData Central

`GET /api/v1/food-data/search?q={food_name}&limit=5`

Returns `FoodDataSearchResponse` with `available`, warning, and up to five `FoodDataCandidate` objects. Each candidate includes FDC ID, description, data type, optional brand/ingredients, available per-100-g nutrients, and source metadata.

When `USDA_FDC_API_KEY` is missing:

```json
{
  "query": "white rice",
  "candidates": [],
  "available": false,
  "sourceId": "usda-fdc",
  "warning": "USDA FoodData Central is not configured; use the curated qualitative fallback."
}
```

Errors:
- `422`: invalid query or limit
- `503`: configured USDA search timed out or failed

### Finalize Estimated Meal

`POST /api/v1/unlabeled-meal-analyses/{analysis_id}/finalize`

Example payload:

```json
{
  "mealName": "Rice and chicken lunch",
  "meal": "Lunch",
  "components": [
    {
      "componentId": "component-uuid",
      "confirmedName": "White rice, cooked",
      "fdcId": 169756,
      "householdPortion": "1 cup",
      "gramRange": { "minimum": 120, "maximum": 180, "unit": "g" },
      "contextOnly": false,
      "qualitativeTags": ["rice"]
    }
  ]
}
```

Every component must have a non-empty identity and household portion plus a finite, ordered `1–5000 g` range. A numeric component requires a USDA FDC ID; otherwise it must be marked `contextOnly`.

The backend retrieves USDA details itself and calculates each available nutrient as:

```text
per-100-g nutrient × confirmed gram endpoint / 100
```

The returned `EstimatedMealRecord` includes confirmed component/source snapshots, component nutrient ranges, aggregate known-component ranges, matched/excluded counts, per-nutrient unknown counts, `partial`, limitations, evidence trails, and provenance. Context-only components are excluded from every aggregate. Missing USDA nutrients remain unknown.

Successful finalize deletes the short-lived job and backend image. Errors:
- `404`: missing or expired analysis
- `409`: analysis is still processing
- `422`: invalid confirmation, unavailable selected USDA details, duplicate component, or invalid range

### Delete Estimated-Meal Analysis

`DELETE /api/v1/unlabeled-meal-analyses/{analysis_id}`

Deletes the in-memory job and temporary image directory. Returns `204 No Content`, including when the job no longer exists.

### Resolve Smart Context

`POST /api/v1/smart-context/resolve`

This stateless endpoint accepts `kind` (`packaged_label`, `curated_unlabeled_demo`, or `estimated_unlabeled_meal`), record/meal/market identity, exact nutrient values or ranges with evidence types, context flags, qualitative tags, limitations, and excluded-component count.

Returns `SmartContextResponse`:

```json
{
  "triggeredRuleIds": ["estimated-boundary", "fiber-anchor"],
  "cards": [
    {
      "id": "fiber-anchor",
      "ruleId": "fiber-anchor",
      "title": "Add a fiber anchor",
      "body": "...",
      "evidenceLabels": ["Carbs 20–35 g", "Fiber 0.5–2.5 g"],
      "actions": ["Ginisang monggo", "Itlog or isda", "Pinakbet or other gulay"],
      "sourceIds": ["sydney-gi-overview"]
    }
  ],
  "sources": [],
  "evidenceSourceIds": ["sydney-gi-overview"],
  "generationMode": "deterministic",
  "warnings": [],
  "provenance": {
    "ruleVersion": "smart-context-rules-ph-v1",
    "evidenceVersion": "smart-context-evidence-v1",
    "pairingVersion": "ph-pairings-v1",
    "writerVersion": "grounded-writer-v1",
    "model": null,
    "cacheHit": false,
    "fallbackReason": null
  }
}
```

Estimated nutrient rules trigger only when the entire range supports the threshold. Threshold-crossing ranges receive `uncertainty-boundary`. Optional writer output is accepted only if rule IDs, evidence labels, actions, sources, and numbers validate; every failure returns deterministic cards.

#### Context snack pairing note

The packaged-label `Pair with this snack` Context section is not a backend endpoint. The browser derives it from the confirmed packaged-label product context through controlled client configuration in `src/domain/pairing.ts`.

API boundaries:
- It does not call `POST /api/v1/chat/stream` or ask an LLM to invent pairings.
- It does not call Tavily or live web search on page load.
- It does not submit or mutate scanned-product nutrient fields.
- It uses static source IDs that must resolve to known source metadata before an option can render.
- Unknown or ineligible product categories produce no fabricated suggestions.

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

Returns the legacy `UnlabeledFoodIdentifyResponse` with filename-alias demo hints. The current estimated-meal UI does not use filename matching; this route remains for backward compatibility. If no candidate is found, `method` is `manual_catalog_fallback` and `candidates` is empty.

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

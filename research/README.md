# Sugar pAI research protocol

Sugar pAI V2 is evaluated as a packaged-label and estimated-meal evidence prototype. Automated extraction or image identification is only a proposal step; an accepted record consists of user-confirmed evidence, deterministic calculations, explicit uncertainty, and the saved Smart Context snapshot.

## Packaged-label benchmark

The automated extraction proof point is evaluated before any VLM provider becomes a default. Build a gold set of 100 packaged products: 50 Philippine and 50 US products, balanced across beverages, cereals, dairy, snacks, sauces, baked products, sugar-free/polyol products, and imported goods.

For each product, capture a nutrition panel and ingredient panel under clean and challenging conditions. Include glare, curved packages, rotation, small text, dual-column formats, per-serving/per-100 g formats, and missing added-sugar declarations. Two annotators independently record the gold fields and sugar spans; adjudicate disagreements. Split at the product level into 30 development and 70 locked evaluation products.

For products with readable UPC/EAN codes, record the barcode and whether the generated local Open Food Facts database contains a complete, partial, or missing match. Compare local database fields against the photographed current package; database-prefilled values are useful only when the user can confirm them during review.

Run the same images and schema through pinned candidates. A provider is eligible only if it meets every gate:

- ≥95% exact match for serving size, total carbohydrate, fiber, total sugars, and added sugars on images that pass quality checks
- ≥95% precision and ≥90% recall for sugar-variant detection
- 100% of accepted numeric values linked to image or database evidence
- Zero fabricated verified values and zero unsupported numeric GI results
- 100% schema-valid responses after one retry
- Median complete-scan cost ≤US$0.05 and p95 latency ≤12 seconds

Among eligible models, select the lowest median-cost candidate and pin its exact model ID. If none qualifies, keep manual correction as the accepted path and report that automated extraction did not pass.

Store benchmark rows using `benchmark.schema.json`. Never commit patient data, credentials, copyrighted GI tables, or production package images without explicit reuse permission.

## Development runner

Use the synthetic fixtures only to smoke-test metrics wiring:

```bash
PYTHONPATH=backend python -m app.benchmark \
  --annotations research/fixtures/synthetic_benchmark.json \
  --predictions research/fixtures/synthetic_predictions.json
```

For the 20-30 item development run, keep real product images private and store predictions in the same shape as `research/fixtures/synthetic_predictions.json`. Required reported metrics are total sugar MAE, exact match for serving/carbohydrate/fiber/sugars, sugar-alias precision/recall, schema-valid-after-retry rate, p95 latency, API error count, and fallback counts.

Regenerate the local Open Food Facts runtime database after updating `openfoodfacts_export.csv`:

```bash
PYTHONPATH=backend python -m app.db.ingest_off \
  --csv research/openfoodfacts_export.csv \
  --db backend/app/data/off_ph_products.db
```

Track barcode hit rate, complete-record rate, partial-record missing fields, and disagreement rate versus the current photographed label.

## Estimated unlabeled-meal benchmark

Evaluate the estimated-meal path separately from packaged-label extraction. Build a consented meal-photo set that represents one- and multi-component Philippine meals, occlusion, mixed dishes, sauces, varied lighting, and realistic household portions. Split by meal, not by image, so near-duplicate views never cross development and evaluation sets.

The meal-image model is evaluated only on its allowed schema: component name, preparation clues, household portion, gram minimum/maximum, and confidence. It must never return calories, macros, GI, GL, or a personal glucose prediction. Cap accepted output at 12 components, test invalid-schema retry once, and report:

- component top-1 and top-5 identity accuracy;
- missed, merged, and hallucinated component rates;
- schema-valid-after-retry and prohibited-macro rates;
- portion-range coverage of the adjudicated reference weight, plus range width;
- confidence calibration and latency;
- successful manual add, remove, rename, and remap rates.

For USDA matching, retain the selected FDC ID and source snapshot. Report candidate recall, confirmed-match accuracy, missing-nutrient frequency, API/cache/timeout behavior, and calculation agreement with `per100g × confirmed grams / 100`. Automated tests should use mocked USDA responses; controlled live evaluation requires a server-only key and a pinned query set.

Evaluate complete and partial meals. A component without a credible confirmed match must become context-only and be excluded from every numeric aggregate. Verify that the UI and export state the excluded-component count, preserve unknown nutrient counts, and never call a matched-component subtotal a complete-meal total. The `~midpoint` display must always remain paired with its minimum–maximum range.

The Filipino-food catalog remains the qualitative fallback for unavailable vision or USDA matching. It may include allowed names, aliases, portion labels, qualitative tags, and limitations. It must not originate authoritative calories, macros, GI, GL, or FNRI-derived claims unless a permitted dataset and matching protocol are added later.

## Smart Context evaluation

Evaluate rule selection independently from generated wording. Fixtures must cover exact values, fixed ranges, estimated ranges wholly above/below thresholds, ranges crossing each threshold, missing nutrients, context-only components, Philippine category aliases, and partial meals. For every fixture, assert rule IDs, actions, evidence/source IDs, warnings, and cache-version behavior.

The optional writer receives only preselected facts, cards, actions, pairings, and citations. Test malformed JSON, unknown/duplicate rule IDs, changed actions or evidence labels, invented numbers, unknown sources, prohibited medical/suitability/medication/glucose-prediction claims, timeout, and network failure. Every failure must return the deterministic cards. Generated-copy evaluation should score factual preservation and clarity, never whether the model selected the advice.

Tavily evaluation is limited to evidence-chat source retrieval from the authoritative-domain allowlist. Web text must never originate nutrient grams. Run external-service cases with mocks in routine CI and document credentials, model versions, latency, and retrieval date for controlled live runs.

## GI and GL policy

No FNRI, Trinidad, or other licensed GI source data is bundled in this repository. Until licensed records are provided and matched, the application must keep `sourced` GI unavailable. Packaged-label records may show only the explicitly labeled `heuristic_demo` GL output; curated fallback and estimated-meal records must not display numeric GI or GL.

Smart Context copy must not make permission-style, treatment, medication, insulin, or glucose-prediction claims. Movement content remains optional education, not personal exercise advice.

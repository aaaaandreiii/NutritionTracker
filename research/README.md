# Benchmark protocol

The automated extraction proof point is evaluated before any OCR/VLM provider becomes a default. Build a gold set of 100 packaged products: 50 Philippine and 50 US products, balanced across beverages, cereals, dairy, snacks, sauces, baked products, sugar-free/polyol products, and imported goods.

For each product, capture a nutrition panel and ingredient panel under clean and challenging conditions. Include glare, curved packages, rotation, small text, dual-column formats, per-serving/per-100 g formats, and missing added-sugar declarations. Two annotators independently record the gold fields and sugar spans; adjudicate disagreements. Split at the product level into 30 development and 70 locked evaluation products.

Run the same images and schema through pinned candidates. A provider is eligible only if it meets every gate:

- ≥95% exact match for serving size, total carbohydrate, fiber, total sugars, and added sugars on images that pass quality checks
- ≥95% precision and ≥90% recall for sugar-variant detection
- 100% of accepted numeric values linked to image or database evidence
- Zero fabricated verified values and zero unsupported numeric GI results
- 100% schema-valid responses after one retry
- Median complete-scan cost ≤US$0.05 and p95 latency ≤12 seconds

Among eligible models, select the lowest median-cost candidate and pin its exact model ID. If none qualifies, keep the current OCR/manual-correction mode and report that automated extraction did not pass.

Store benchmark rows using `benchmark.schema.json`. Never commit patient data, credentials, copyrighted GI tables, or production package images without explicit reuse permission.

## Development runner

Use the synthetic fixtures only to smoke-test metrics wiring:

```bash
PYTHONPATH=backend python -m app.benchmark \
  --annotations research/fixtures/synthetic_benchmark.json \
  --predictions research/fixtures/synthetic_predictions.json
```

For the 20-30 item development run, keep real product images private and store predictions in the same shape as `research/fixtures/synthetic_predictions.json`. Required reported metrics are total sugar MAE, exact match for serving/carbohydrate/fiber/sugars, sugar-alias precision/recall, schema-valid-after-retry rate, p95 latency, API error count, and fallback counts.

No FNRI, Trinidad, or other licensed GI source data is bundled in this repository. Until licensed records are provided and matched, the application must keep `sourced` GI unavailable and may show only the explicitly labeled `heuristic_demo` GL output.

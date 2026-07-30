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

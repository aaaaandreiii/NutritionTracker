# Sugar pAI demo path

## Runtime and Docker

- [x] Add Docker Compose with isolated frontend and backend services.
- [x] Install Tesseract in the backend image and pin compatible Python dependencies.
- [x] Ignore local `.env` files and provide `.env.example`.
- [ ] Run `docker compose up --build` on the demo machine and confirm host Ollama access through `host.docker.internal`.

## Live OCR and DeepSeek extraction

- [x] Add selectable OCR provider: `SUGAR_PAI_OCR_PROVIDER=tesseract|paddle`.
- [x] Use Tesseract as the default provider.
- [x] Return a clear configuration error when PaddleOCR is selected but not installed.
- [x] Add Ollama-compatible DeepSeek extraction with `deepseek-v4-flash:cloud`.
- [x] Enforce strict JSON, one validation retry, timeouts, and manual fallback.
- [x] Reject extracted values that fail deterministic nutrient arithmetic.
- [ ] Benchmark DeepSeek against the private 20-30 image development set before treating OCR values as more than review prefill.

## Sugar taxonomy and heuristic GL demo

- [x] Expand the sugar alias taxonomy to 60+ English/Filipino label terms.
- [x] Keep ingredient matches as taxonomy evidence only; do not attach grams or product GI to variant rows.
- [x] Add `heuristic_demo` glycemic status separate from `sourced` and `unavailable`.
- [x] Compute demo net carbohydrate only when total carbohydrate and fiber are known.
- [x] Subtract sugar alcohols only when explicitly declared.
- [x] Add GL bands: green `<= 10`, yellow `> 10 && < 20`, red `>= 20`.
- [x] Show non-medical deterministic interpretation and safety disclaimers.

## Sourced GI data path

- [x] Add a GI data loader/retriever scaffold with synthetic fixtures for tests.
- [ ] Obtain licensed FNRI/Trinidad/tested-product GI source files before enabling `sourced` GI.
- [ ] Add ingestion checks for citation, licensing, food form, and exact/same-form match level.
- [ ] Keep sourced GI unavailable when no licensed match exists.

## Benchmark and LLMOps

- [x] Add a benchmark metrics runner for the existing annotation contract.
- [x] Track total sugar MAE, exact numeric matches, sugar-alias precision/recall, schema-valid-after-retry rate, p95 latency, API errors, and fallback counts.
- [x] Add structured telemetry for OCR/LLM latency, model, provider, token counts, JSON failures, API errors, and fallback reasons.
- [x] Mirror telemetry to MLflow only when `MLFLOW_TRACKING_URI` is configured.
- [ ] Build and annotate the private 20-30 item development image set.

## Review UI integration

- [x] Prefill `EvidenceReview` with unconfirmed `Read from label` values from OCR/DeepSeek.
- [x] Recompute taxonomy matches and heuristic GL after user corrections.
- [x] Keep manual review mandatory before local logging.
- [ ] Run final mobile and desktop UX smoke tests with real photos.

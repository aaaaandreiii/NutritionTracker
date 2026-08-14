# Sugar pAI V2

Sugar pAI is a privacy-first packaged-food and estimated-meal decision-support prototype with grounded Smart Context. Packaged foods follow a barcode/label evidence flow; unlabeled meals follow component identification, user confirmation, USDA-backed range calculation, and qualitative fallback. Confirmed records are logged locally. Daily Dozen tracking remains supporting whole-food tooling.

## What V2 Does

- **Barcode-first packaged flow:** The scan page opens with a live UPC/EAN scanner, manual barcode entry, local database lookup, and label-photo fallback.
- **Local barcode lookup:** When enabled, UPC/EAN scans query a generated local Open Food Facts Philippines SQLite database before any label-image extraction. UPC-A and zero-prefixed EAN-13 variants resolve to the same database row.
- **Deterministic validation:** Backend checks preserve unknown values, reject impossible sugar/carbohydrate arithmetic, and never turn missing fields into zero.
- **Smart Context:** After backend validation, the app shows context rules for fiber, protein/fat, food order, ingredient flags, movement education, and data limits.
- **Ingredient context flags:** Sugar aliases, high-fructose corn syrup, maltodextrin, starches, polyols, high-intensity sweeteners, and processing markers are shown as descriptive context rather than ratings.
- **Context snack pairings:** For eligible confirmed packaged snacks, Context can show controlled companion-food ideas such as peanut butter, plain yogurt, cheese, and whole fruit. These suggestions use deterministic rules and structured supporting sources; they never change the scanned product's confirmed nutrition values.
- **Estimated unlabeled meals:** A meal photo can identify up to 12 visible components without producing macros. Users confirm each identity, USDA match, household portion, and 1–5000 g range before the backend derives nutrient ranges.
- **Honest qualitative fallback:** Components without a credible USDA match stay context-only and are excluded from numeric aggregates. The Filipino-food catalog remains available when vision or USDA is unavailable.
- **Local history:** Confirmed records are stored in browser IndexedDB. Packaged-label and estimated-meal source images are retained only through explicit local opt-in.
- **Evidence chat:** `#/sugar-pai/ask` streams Markdown answers grounded in a selected local product plus curated sources, with interactive citation highlighting and browser-local thread history.

## Safety Boundary

Sugar pAI is not a diagnostic, treatment, medication, insulin, or glucose-prediction system. It avoids permission-style food claims and guarantees about glucose response.

GI and GL are handled conservatively:

- `sourced` GI remains unavailable unless a licensed/permitted tested-food dataset is added later.
- Packaged-label demo GL may appear only as clearly labeled `heuristic_demo` output.
- Estimated unlabeled meals never receive numeric GI/GL or personal glucose predictions. Their ranges express confirmed portion uncertainty only.
- Curated/context-only components do not display calories, macros, GI, GL, or FNRI-derived claims and never silently count as zero.
- Ingredient aliases and catalog tags are context descriptors only.
- Snack pairing ideas are general companion-food context, not product-specific clinical recommendations. They are separate from the scanned product record and do not add, impute, offset, or recalculate nutrients.

## Backend Interfaces

- `POST /api/v1/analyses`
- `GET /api/v1/off-products/{barcode}?market=PH`
- `POST /api/v1/analyses/barcode`
- `GET /api/v1/analyses/{analysis_id}/events`
- `POST /api/v1/analyses/{analysis_id}/finalize`
- `POST /api/v1/label-records/validate`
- `GET /api/v1/unlabeled-foods/catalog?market=PH`
- `POST /api/v1/unlabeled-foods/identify`
- `POST /api/v1/unlabeled-food-records/validate`
- `POST /api/v1/unlabeled-meal-analyses` (multipart `food_image` or manual `description`, `market=PH`)
- `GET /api/v1/unlabeled-meal-analyses/{analysis_id}/events` (SSE image-check, identification, matching, and result events)
- `GET /api/v1/food-data/search?q=...&limit=5`
- `POST /api/v1/unlabeled-meal-analyses/{analysis_id}/finalize`
- `DELETE /api/v1/unlabeled-meal-analyses/{analysis_id}`
- `POST /api/v1/smart-context/resolve`
- `POST /api/v1/chat/stream` (POST-based SSE: `stage`, `sources`, `delta`, `done`, and `error`)

## Evidence and estimate semantics

Every evidence value retains its legacy `sourceKind`, status, confirmation, and image reference while adding an evidence type (`observed`, `retrieved`, `estimated`, `derived`, `contextual`, or `unavailable`), optional range/confidence band, timestamped trail, and source metadata.

The estimated-meal evidence path is deliberately split:

1. Ollama proposes food identities, visible preparation clues, household portions, gram ranges, and confidence—never nutrients.
2. The user confirms or edits every component and selects a USDA FoodData Central record, or marks it context-only.
3. FastAPI retrieves USDA per-100-g nutrients and multiplies each available value by the confirmed minimum and maximum grams.
4. Aggregates sum known matched-component ranges. Excluded components and missing nutrient counts remain attached, so a subtotal cannot be mistaken for a complete meal total.
5. Backend deterministic rules resolve Smart Context. Estimated nutrient rules trigger only when the full range supports the threshold; boundary-crossing ranges receive an uncertainty card.

Smart Context responses include rule IDs, cards, actions, source IDs, warnings, generation mode, cache state, and rule/evidence/pairing/writer versions. The browser stores that snapshot with the log so History does not regenerate different copy later.

The packaged-label Context page also builds a small local `Pair with this snack` section from the confirmed product context. It is not a chat response and does not call an LLM. Eligibility is category-based and conservative: cracker, biscuit, bread, cereal-type snack, and similar snack contexts can receive a small controlled set of companion ideas; unknown categories omit the section.

## Quickstart

```bash
docker-compose up --build
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Sugar pAI default route: `#/sugar-pai/scan`
- Backend API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Local Development

```bash
npm install
npm run typecheck
npm run test
npm run dev
```

Backend tests require the backend dependencies plus `backend/requirements-dev.txt`:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt -r backend/requirements-dev.txt
PYTHONPATH=backend .venv/bin/pytest backend/tests
```

Use Python 3.13 or earlier for the pinned backend stack; Python 3.14 can fail to build the pinned `pydantic-core` dependency.

To regenerate the local Open Food Facts database from the research CSV:

```bash
PYTHONPATH=backend python -m app.db.ingest_off \
  --csv research/openfoodfacts_export.csv \
  --db backend/app/data/off_ph_products.db
```

Set `SUGAR_PAI_ENABLE_OFF_LOOKUP=true` to enable local lookup. `SUGAR_PAI_OFF_DB_PATH` defaults to `backend/app/data/off_ph_products.db`.

Evidence chat uses `SUGAR_PAI_CHAT_MODEL` (falling back to `SUGAR_PAI_VISION_MODEL`) and `SUGAR_PAI_CHAT_TIMEOUT_SECONDS=120`. `TAVILY_API_KEY` is optional; missing credentials or search failures use curated evidence only. Conversations remain in browser IndexedDB and are not stored by FastAPI.

Estimated meals use server-only `USDA_FDC_API_KEY`. With no key, FoodData Central search reports unavailable and the UI keeps the curated context-only path usable. `SUGAR_PAI_MEAL_VISION_MODEL` and `SUGAR_PAI_MEAL_VISION_TIMEOUT_SECONDS` configure meal identification. Ollama failures do not remove manual search or curated fallback.

Grounded Smart Context writing is optional and disabled by default (`SUGAR_PAI_SMART_CONTEXT_WRITER=false`). When enabled, the writer may rewrite supplied deterministic cards only; unknown IDs, numbers, actions, sources, prohibited claims, invalid JSON, timeout, or network failure preserves the deterministic response. Telemetry records stage latency, source path, cache hits, and fallback reason, but never images or raw notes.

Backend meal images live only in the short-lived analysis directory and are deleted on finalize, explicit cleanup, or the 15-minute job expiry. A source photo enters IndexedDB only through the explicit local opt-in shown after finalization. Estimated logs are read-only in this release; delete and recreate one to change it.

For same-domain tunnels or reverse proxies, build the frontend with `VITE_API_BASE_URL=same-origin` and route API paths plus `/health` to the backend service. With `cloudflared` path rules, use `/api/.*` for nested API routes.

## Daily Dozen Support

The original Daily Dozen dashboard, pantry, grocery, recipe, and meal-log views remain available from the top navigation. Sugar pAI records can add local snapshots into meal slots, but Daily Dozen targets are secondary to the V2 Sugar pAI research flow.

## Research Data Policy

Do not commit patient data, credentials, copyrighted GI tables, licensed nutrition datasets, or production package images without explicit reuse permission. Curated Filipino-food demo entries are qualitative placeholders until a permitted authoritative dataset is added.

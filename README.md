# Sugar pAI research MVP

Sugar pAI is a mobile-first packaged-food label research tool. It distinguishes photographed evidence, community database matches, user confirmations, conflicts, and unavailable data. It does **not** infer a product GI from label nutrients, predict glucose response, or give treatment advice.

## What works

- Guided Nutrition Facts, ingredients, and front/barcode capture with client and server image checks
- Local UPC/EAN decoding with ZXing
- Short-lived FastAPI job state and real server-sent pipeline events
- Optional Open Food Facts barcode lookup, kept visibly separate from current-label evidence
- Manual review of serving size and carbohydrate-first nutrient fields
- Deterministic arithmetic checks and English/Filipino sugar-ingredient taxonomy
- GI/GL suppression unless eligible sourced evidence exists (none is bundled)
- IndexedDB Today/History records, known-versus-missing totals, CSV/JSON export, per-record deletion, and delete-all
- PWA manifest and offline shell; original images are stored locally only after explicit opt-in

No OCR or VLM provider is enabled by default. In this state, the service returns an honest partial result and requires manual confirmation. This is intentional until a provider passes the locked benchmark.

## Run locally

The frontend uses Node; the API commands below use the existing `personal_projects` Conda environment.

```bash
npm install

source /Users/balingit.andrei/miniconda3/etc/profile.d/conda.sh
conda activate personal_projects
uvicorn backend.app.main:app --reload --port 8000
```

In another terminal:

```bash
npm run dev
```

Open `http://localhost:5173`. Set `VITE_API_BASE_URL` when the API is hosted elsewhere.

Open Food Facts lookup is off by default so development scans do not unexpectedly contact an external service. Enable it explicitly before starting the API:

```bash
export SUGAR_PAI_ENABLE_OFF_LOOKUP=true
```

Only the barcode is sent to Open Food Facts. Images remain in the temporary analysis service and are deleted after 15 minutes or an explicit `DELETE` request.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build

source /Users/balingit.andrei/miniconda3/etc/profile.d/conda.sh
conda activate personal_projects
PYTHONPATH=backend pytest -q backend/tests
```

## API contract

- `POST /api/v1/analyses` — multipart `nutrition_image`, optional `ingredient_image` / `front_image` / `barcode`, and `market=PH|US`; returns `202`
- `GET /api/v1/analyses/{id}/events` — server-sent stage and result events
- `POST /api/v1/analyses/{id}/finalize` — applies user corrections and reruns deterministic validation
- `DELETE /api/v1/analyses/{id}` — deletes temporary job state and images

The OpenAPI explorer is at `http://localhost:8000/docs`.

## Repository map

- `src/domain/` — TypeScript evidence, nutrition, glycemic, and log types
- `src/components/mvp/` — active four-route product UI
- `src/lib/` — API, local barcode, image quality, and IndexedDB adapters
- `backend/app/` — schemas, state machine, validation, and taxonomy
- `backend/tests/` — API lifecycle and safety-focused unit tests
- `research/` — benchmark protocol and machine-readable annotation schema

The earlier Daily Dozen, pantry, grocery, and recipe components remain in `src/components/` as deferred, unreachable code. The unsafe simulated Sugar pAI scanner and its fabricated results were removed.

## Safety boundary

This is an internal, noncommercial research prototype for adults with type 2 diabetes or prediabetes. It is not for diagnosis, treatment, insulin or medication decisions, meal timing, or individual glucose prediction. External testing requires benchmark gates, GI-data permission, privacy review, and registered-dietitian review.

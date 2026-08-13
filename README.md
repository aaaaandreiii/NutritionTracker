# Sugar pAI V2

Sugar pAI is a privacy-first packaged-food decision-support and Smart Context research prototype. The core flow is: scan a barcode first when available, validate the evidence, review deterministic context, then log the record locally. Daily Dozen tracking remains in the app as supporting whole-food tracking, but V2 is positioned around Sugar pAI.

## What V2 Does

- **Barcode-first packaged flow:** The scan page opens with a live UPC/EAN scanner, manual barcode entry, local database lookup, and label-photo fallback.
- **Local barcode lookup:** When enabled, UPC/EAN scans query a generated local Open Food Facts Philippines SQLite database before any label-image extraction.
- **Deterministic validation:** Backend checks preserve unknown values, reject impossible sugar/carbohydrate arithmetic, and never turn missing fields into zero.
- **Smart Context:** After backend validation, the app shows context rules for fiber, protein/fat, food order, ingredient flags, movement education, and data limits.
- **Ingredient context flags:** Sugar aliases, high-fructose corn syrup, maltodextrin, starches, polyols, high-intensity sweeteners, and processing markers are shown as descriptive context rather than ratings.
- **Curated unlabeled demo mode:** A Filipino-food demo catalog can suggest candidates from a food photo filename hint, but the user must confirm food and portion before Smart Context appears.
- **Local history:** Confirmed records are stored in browser IndexedDB. Source images are retained only when the user opts in for packaged-label records.

## Safety Boundary

Sugar pAI is not a diagnostic, treatment, medication, insulin, or glucose-prediction system. It avoids permission-style food claims and guarantees about glucose response.

GI and GL are handled conservatively:

- `sourced` GI remains unavailable unless a licensed/permitted tested-food dataset is added later.
- Packaged-label demo GL may appear only as clearly labeled `heuristic_demo` output.
- Curated unlabeled demo records do not display calories, macros, GI, GL, or FNRI-derived claims.
- Ingredient aliases and catalog tags are context descriptors only.

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

For same-domain tunnels or reverse proxies, build the frontend with `VITE_API_BASE_URL=same-origin` and route `/api/*` plus `/health` to the backend service.

## Daily Dozen Support

The original Daily Dozen dashboard, pantry, grocery, recipe, and meal-log views remain available from the top navigation. Sugar pAI records can add local snapshots into meal slots, but Daily Dozen targets are secondary to the V2 Sugar pAI research flow.

## Research Data Policy

Do not commit patient data, credentials, copyrighted GI tables, licensed nutrition datasets, or production package images without explicit reuse permission. Curated Filipino-food demo entries are qualitative placeholders until a permitted authoritative dataset is added.

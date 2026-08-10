# NutritionTracker

NutritionTracker is now the merged Daily Dozen tracker plus the Sugar pAI packaged-food label research MVP.

The existing Daily Dozen workflows remain at `#/dashboard`, `#/pantry`, and `#/recipes`. Sugar pAI runs inside the same app shell at `#/sugar-pai/scan`, `#/sugar-pai/today`, `#/sugar-pai/history`, and `#/sugar-pai/about`.

## Sugar pAI

Sugar pAI is a VLM-only label analysis flow backed by FastAPI. It accepts Nutrition Facts, ingredients, and front/barcode images, runs image quality checks, optionally decodes/looks up a barcode, sends sanitized panels to `SUGAR_PAI_VISION_MODEL` through an Ollama-compatible API, and requires manual review before saving.

Confirmed Sugar pAI records are stored in IndexedDB for Today/History. After a confirmed save, the app also adds a lightweight Daily Dozen meal snapshot to the mapped meal slot with `servings: {}` and `cals: 0`; packaged foods do not affect Daily Dozen category progress.

## Run Locally

```bash
npm install
cp .env.example .env
```

Start the API:

```bash
uvicorn backend.app.main:app --reload --port 8000
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Docker

```bash
cp .env.example .env
docker-compose up --build
```

The frontend runs on `http://localhost:5173`; the API runs on `http://localhost:8000`.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
PYTHONPATH=backend pytest -q backend/tests
```

## API

- `POST /api/v1/analyses` accepts multipart `nutrition_image`, optional `ingredient_image`, optional `front_image`, optional `barcode`, and `market=PH|US`.
- `GET /api/v1/analyses/{id}/events` streams stage and result events.
- `POST /api/v1/analyses/{id}/finalize` applies user corrections and reruns deterministic validation.
- `DELETE /api/v1/analyses/{id}` deletes temporary job state and images.

## Boundary

This is a research prototype. It does not diagnose, treat, predict individual glucose response, or guide medication or insulin decisions. Unknown label values stay unknown until the user confirms them.

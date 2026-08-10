# NutritionTracker Feature Inventory

This folder contains the deployment app: a React/Vite Daily Dozen tracker with the Sugar pAI FastAPI research backend merged in.

## Routes

- `#/dashboard` - Daily Dozen progress, targets, food suggestions, and meal slots.
- `#/pantry` - pantry inventory and grocery list management.
- `#/recipes` - recipe catalog, recipe creation, grocery helpers, and cook/log workflow.
- `#/sugar-pai/scan` - packaged-food label scanner.
- `#/sugar-pai/today` - local Sugar pAI totals for today.
- `#/sugar-pai/history` - local Sugar pAI history, export, and deletion.
- `#/sugar-pai/about` - research boundary and processing disclosure.

## Daily Dozen Features

- Tracks Daily Dozen servings, calories, deficits, presets, and custom targets.
- Supports breakfast, morning snack, lunch, afternoon snack, and dinner meal logs.
- Keeps the existing pantry, grocery, and recipe workflows.
- Persists recipes in `localStorage`; most Daily Dozen state remains in memory.

## Sugar pAI Features

- Captures Nutrition Facts, ingredients, and front/barcode panels through upload or camera.
- Runs client and server image quality checks.
- Decodes UPC/EAN barcodes locally and can optionally query Open Food Facts.
- Uses a single VLM extraction path through `SUGAR_PAI_VISION_MODEL`, default `gemma4:12b`.
- Streams backend stages for image checks, barcode lookup, VLM extraction, ingredient classification, evidence assembly, and validation.
- Keeps blank and ambiguous values unknown instead of treating them as zero.
- Requires manual review and deterministic validation before saving.
- Classifies sugar-related ingredients with the versioned English/Filipino taxonomy.
- Stores confirmed records in IndexedDB with Today/History views and CSV/JSON export.
- Optionally stores original images locally only after explicit opt-in.
- Adds a lightweight Daily Dozen meal snapshot after a confirmed save without changing Daily Dozen category progress.

## Backend Features

- FastAPI service with short-lived in-memory analysis jobs and temporary image cleanup.
- Sanitizes uploads, strips EXIF, and limits image size.
- Runs VLM label extraction through an Ollama-compatible `/api/generate` endpoint.
- Keeps optional Open Food Facts lookup off unless `SUGAR_PAI_ENABLE_OFF_LOOKUP=true`.
- Preserves source/provenance distinctions between label, database, user, calculated, and unavailable values.
- Provides deterministic nutrient arithmetic checks and prohibited-claim checks.
- Keeps sourced GI unavailable unless licensed evidence is supplied; heuristic demo GL remains explicitly labeled.

## Packaging And Tests

- TypeScript support is added for the Sugar pAI modules without converting the existing JSX Daily Dozen files.
- PWA manifest and service worker are registered for production builds.
- Docker files and Vercel rewrite are included in the deployment folder.
- Frontend checks: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Backend checks: `PYTHONPATH=backend pytest -q backend/tests`.

## Limitations

- Daily Dozen state is still mostly local/in-memory.
- Sugar pAI history is local to one browser/device.
- No accounts, auth, cloud sync, or backend history storage are included.
- The app is not a medical device and does not provide diagnosis, treatment, insulin/medication guidance, or individualized glucose prediction.

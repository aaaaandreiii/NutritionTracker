# Deployment and Configuration Guide

This document details how to deploy Sugar pAI V2 and its supporting Daily Dozen views.

## Infrastructure Details
Sugar pAI is orchestrated via Docker Compose.
- **Frontend Container (`frontend`):** A Node environment that builds and serves the Vite React application.
- **Backend Container (`backend`):** A Python environment running Uvicorn and FastAPI.

## Environment Variables
The application relies on environment variables defined in a `.env` file at the repository root.

### Example `.env.example`
```ini
# Backend VLM Configuration
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
SUGAR_PAI_VISION_MODEL=gemma4:12b
SUGAR_PAI_VISION_TIMEOUT_SECONDS=120
SUGAR_PAI_MEAL_VISION_MODEL=gemma4:12b
SUGAR_PAI_MEAL_VISION_TIMEOUT_SECONDS=120
SUGAR_PAI_CHAT_MODEL=gemma4:12b
SUGAR_PAI_CHAT_TIMEOUT_SECONDS=120
TAVILY_API_KEY=

# USDA FoodData Central (server only)
USDA_FDC_API_KEY=
USDA_FDC_TIMEOUT_SECONDS=12

# Optional grounded Smart Context writer
SUGAR_PAI_SMART_CONTEXT_WRITER=false
SUGAR_PAI_SMART_CONTEXT_MODEL=gemma4:12b
SUGAR_PAI_SMART_CONTEXT_TIMEOUT_SECONDS=30

# Backend Feature Flags
SUGAR_PAI_ENABLE_OFF_LOOKUP=false
SUGAR_PAI_OFF_DB_PATH=backend/app/data/off_ph_products.db
MLFLOW_TRACKING_URI=

# Frontend Configuration
# Use `same-origin` when a tunnel or reverse proxy routes API paths and /health to the backend.
VITE_API_BASE_URL=http://localhost:8000
```

*Note: When running Ollama locally on the host machine while the backend is in a Docker container, `host.docker.internal` is crucial for the container to access the host's Ollama API port.*

`SUGAR_PAI_MEAL_VISION_MODEL` and `SUGAR_PAI_CHAT_MODEL` fall back to the general vision model when omitted. `TAVILY_API_KEY` is optional: without it, or if Tavily fails, chat retrieval remains curated-only.

`USDA_FDC_API_KEY` must remain server-side. When it is missing, `GET /api/v1/food-data/search` returns `available: false` and the estimated-meal UI remains usable through context-only curated records. Do not expose USDA or Tavily credentials through `VITE_` variables, frontend bundles, Compose diagnostic output, screenshots, or logs.

`SUGAR_PAI_SMART_CONTEXT_WRITER=false` is the recommended default. Deterministic rule resolution does not require Ollama. When writer mode is enabled, timeout, invalid JSON, unknown IDs, invented claims, or model unavailability automatically returns deterministic cards.

The packaged-label `Pair with this snack` Context section has no deployment environment variable. It is controlled by static client-side configuration and source metadata, and it does not call Ollama, Tavily, USDA, or a live recommendation endpoint when the Context page renders.

### Local Open Food Facts Database

Barcode lookup uses a generated SQLite artifact at `backend/app/data/off_ph_products.db` by default. Regenerate it when `research/openfoodfacts_export.csv` changes:

```bash
PYTHONPATH=backend python -m app.db.ingest_off \
  --csv research/openfoodfacts_export.csv \
  --db backend/app/data/off_ph_products.db
```

Set `SUGAR_PAI_ENABLE_OFF_LOOKUP=true` to enable local lookup. The lookup path is offline at runtime; the raw CSV is not loaded by the API service.

## Deployment Steps

### Local Deployment (Docker Compose)
The primary deployment strategy for self-hosted instances.
1. Copy `.env.example` to `.env` and adjust variables.
2. Build and launch the containers:
   ```bash
   docker-compose up --build -d
   ```
3. The frontend is accessible at port `5173`, and the backend at `8000`.
4. The default product route is `/#/sugar-pai/scan`.
5. Configure a USDA FoodData Central key only when numeric estimated-meal matching is desired; otherwise verify the curated fallback explicitly.

### Linux VPS / CCS Cloud Deployment (Without Docker)
If your remote instance does not allow running Docker containers, you can use PM2 to manage the processes directly.
1. **Navigate to the project directory:**
   ```bash
   cd /home/aaaaandreiii/STAI100_Sugar-pAI/NutritionTracker
   ```
2. **Install system updates (optional but recommended):**
   ```bash
   sudo apt update
   ```
3. **Install project dependencies:**
   ```bash
   # Activate your Python virtual environment
   source .venv/bin/activate
   # Install Python requirements
   pip install -r backend/requirements.txt
   
   # Install Node packages
   npm install
   ```
4. **Build the frontend:**
   Ensure your `VITE_API_BASE_URL` is configured correctly (e.g., as an environment variable) to point to the external backend IP and port before building.
   ```bash
   npm run build
   ```
5. **Start the application using PM2:**
   The `ecosystem.config.cjs` file orchestrates both the Uvicorn backend and the Vite preview server.
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

### Cloudflare Tunnel Deployment

Do not build the public frontend with a plain `http://<ip>:<port>` backend URL when the app is served over `https://`. Browsers can block that mixed-content request before it reaches FastAPI.

Recommended same-domain setup:

1. Run the frontend and backend on the VM, for example frontend on `127.0.0.1:5173` and backend on `127.0.0.1:2164`.
2. Configure the Cloudflare Tunnel so API paths go to the backend before the catch-all frontend route. In `cloudflared` tunnel configs, `path` is a regular expression, so use `/api/.*` for nested API routes rather than `/api/*`.

   ```yaml
   ingress:
     - hostname: sugar-pai.balingit.me
       path: /api/.*
       service: http://127.0.0.1:2164
     - hostname: sugar-pai.balingit.me
       path: /health
       service: http://127.0.0.1:2164
     - hostname: sugar-pai.balingit.me
       service: http://127.0.0.1:5173
     - service: http_status:404
   ```

   If `cloudflared` runs on the VM host while the backend runs in Docker, use the host-published backend port, not the container-internal port. For example, if `http://103.231.240.130:2164/health` works publicly and `curl http://localhost:2164/health` works on the VM, use `http://127.0.0.1:2164` as the tunnel service.

3. Build or restart the frontend with:

   ```bash
   VITE_API_BASE_URL=same-origin npm run build
   ```

4. Verify that these return FastAPI JSON, not the frontend HTML shell:

   ```bash
   curl -s https://sugar-pai.balingit.me/health
   curl -s 'https://sugar-pai.balingit.me/api/v1/off-products/4800361403764?market=PH'
   ```

Alternative subdomain setup:

1. Add another tunnel public hostname such as `api.sugar-pai.balingit.me` pointing to `http://127.0.0.1:2164`.
2. Build the frontend with `VITE_API_BASE_URL=https://api.sugar-pai.balingit.me`.

### Vercel Deployment (Frontend Only)
If you wish to deploy the frontend to the cloud (Vercel) while keeping the backend local or on a separate VPS:
1. Connect your repository to Vercel.
2. Set the `Build Command` to `npm run build` and `Output Directory` to `dist`.
3. Set the Environment Variable `VITE_API_BASE_URL` to point to your public-facing FastAPI backend URL.
4. The repository includes a `vercel.json` file which automatically handles client-side routing rewrites for the SPA.

### CI/CD Pipeline Steps
While not strictly implemented via GitHub Actions in this repository yet, a standard CI/CD pipeline should include:
1. **Linting & Typechecking:** Run `npm run lint` and `npm run typecheck`.
2. **Frontend Tests:** Run `npm run test` (Vitest).
3. **Backend Tests:** Run `PYTHONPATH=backend pytest backend/tests`.
4. **Build Verification:** Run `npm run build` to ensure the Vite bundler completes without errors.
5. **Docker Build:** Test the Dockerfile builds for both frontend and backend.
6. **End-to-End Tests:** Run `npm run test:e2e`; the suite is intentionally serial because full-page responsive screenshots and route mocks share one local preview process.

## Python Version Note

Use Python 3.13 or earlier for the pinned backend dependency stack. Python 3.14 can fail to build `pydantic-core==2.33.2`.

## V2 Endpoint Smoke Checks

After deployment, verify:

```bash
curl -s http://localhost:8000/health
curl -s 'http://localhost:8000/api/v1/off-products/4800361403764?market=PH'
curl -s 'http://localhost:8000/api/v1/unlabeled-foods/catalog?market=PH'
curl -s 'http://localhost:8000/api/v1/food-data/search?q=white%20rice&limit=5'
curl -s -X POST http://localhost:8000/api/v1/smart-context/resolve \
  -H 'Content-Type: application/json' \
  -d '{"kind":"estimated_unlabeled_meal","displayName":"White rice","market":"PH","meal":"Lunch","nutrients":{"totalCarbohydrate":{"range":{"minimum":20,"maximum":40,"unit":"g"},"evidenceType":"derived"},"fiber":{"range":{"minimum":0.5,"maximum":2,"unit":"g"},"evidenceType":"derived"}},"qualitativeTags":["rice"],"excludedComponentCount":0}'
curl -N -X POST http://localhost:8000/api/v1/chat/stream -H 'Content-Type: application/json' -d '{"question":"What are added sugars?","turns":[]}'
```

The barcode smoke response should report `status: "found"` and `complete: true` when local lookup is enabled. The curated catalog response must not include numeric calories, macros, GI, or GL. USDA search should either return candidate source snapshots or the explicit `available: false` fallback. Smart Context must return deterministic cards even with Ollama/Tavily unavailable.

Frontend smoke checks should also confirm that an eligible SkyFlakes-style packaged snack shows the compact `Pair with this snack` section after Review -> Context, while an unknown category omits it. The section should expose supporting evidence only through the expandable control and should not alter the confirmed product values.

## Operational Fallback Matrix

| Failure | Expected behavior |
| --- | --- |
| Ollama meal vision unavailable or times out | Draft shows a warning; manual food search and curated context-only selection remain available. |
| USDA key missing | Search returns `available: false`; context-only confirmation remains available. |
| USDA request fails after configuration | Search returns `503`; the user can retry or mark the component context-only. |
| Smart Context writer invalid, unavailable, or slow | Deterministic rule cards remain visible and are saved. |
| Snack-pairing source or eligibility does not resolve | The `Pair with this snack` section omits unsupported options or the whole section; product evidence remains unchanged. |
| Tavily missing or unavailable | Evidence chat uses curated sources only; nutrient grams are never taken from Tavily. |
| Browser storage cleared | Local logs, retained opt-in photos, and chat threads are lost; backend has no recovery copy. |

Production monitoring may record stage latency, source path, cache hit, and fallback reason. It must not record source images, raw meal notes, full prompts containing user notes, or server API keys.

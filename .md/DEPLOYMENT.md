# Deployment Guide

## Infrastructure Details
* **Frontend:** Built with Vite and React. Can be deployed on Vercel utilizing the included `vercel.json` for SPA route rewrites (`/index.html` fallback)
* **Backend:** FastAPI application running on Python
* **Model Inference:** Requires an accessible Ollama host running `gemma4:12b`

## Environment Variables (`.env`)
Create a `.env` file based on `.env.example`:
```env
VITE_API_BASE_URL=http://localhost:8000
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=[http://host.docker.internal:11434](http://host.docker.internal:11434)
SUGAR_PAI_VISION_MODEL=gemma4:12b
SUGAR_PAI_VISION_TIMEOUT_SECONDS=120
SUGAR_PAI_ENABLE_OFF_LOOKUP=false
```

## Docker Compose

The project includes a ready-to-use Docker configuration:
1. Ensure .env is configured.
2. Run docker-compose up --
3. The frontend is accessible at http://localhost:5173 and the API at http://localhost:8000


## CI/CD Pipeline Steps

1. Typechecking: `npm run typecheck`
2. Linting: `npm run lint`
3. Frontend Tests: `npm run test`
4. Backend Tests: `PYTHONPATH=backend pytest -q backend/tests`
5. Build: `npm run`
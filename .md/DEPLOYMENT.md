# Deployment & Configuration Guide

This document details how to deploy the NutritionTracker application, including infrastructure configuration and environment variables.

## Infrastructure Details
NutritionTracker is orchestrated via Docker Compose.
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

# Backend Feature Flags
SUGAR_PAI_ENABLE_OFF_LOOKUP=false
MLFLOW_TRACKING_URI=

# Frontend Configuration
VITE_API_BASE_URL=http://localhost:8000
```

*Note: When running Ollama locally on the host machine while the backend is in a Docker container, `host.docker.internal` is crucial for the container to access the host's Ollama API port.*

## Deployment Steps

### Local Deployment (Docker Compose)
The primary deployment strategy for self-hosted instances.
1. Copy `.env.example` to `.env` and adjust variables.
2. Build and launch the containers:
   ```bash
   docker-compose up --build -d
   ```
3. The frontend is accessible at port `5173`, and the backend at `8000`.

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
# Testing Strategy

NutritionTracker employs a split testing strategy, leveraging `Vitest` for the React frontend and `pytest` for the FastAPI backend.

## Automated Test Breakdown

### Frontend (Vitest)
The frontend utilizes `vitest` to run unit and integration tests.
- **Unit Tests:** Verify helper functions (e.g., target calculators, Daily Dozen progress logic).
- **Component Tests:** Verify that React components render correctly given specific state props (e.g., Dashboard renders deficits correctly).
- **Command:** `npm run test`

### Backend (pytest)
The backend utilizes `pytest` to strictly test the extraction and validation logic.
- **Validation Logic:** Ensures the deterministic arithmetic checker correctly flags impossible nutrient combinations (e.g., negative calories, or sugars exceeding total carbs).
- **Taxonomy Matching:** Verifies the `classify_ingredients` function correctly identifies aliases like "maltodextrin" using the `SUGAR_TAXONOMY_VERSION`.
- **Command:** `PYTHONPATH=backend pytest backend/tests` (or simply `pytest` inside the `backend` directory).

## Static Analysis & Code Quality
- **Frontend Typechecking:** Although the Daily Dozen is JSX, the newer Sugar pAI frontend components utilize TypeScript. `npm run typecheck` ensures type safety.
- **Frontend Linting:** ESLint is configured to catch common React hook errors and code style issues (`npm run lint`).

## Load and Performance Testing
Since the primary bottleneck in the application is the VLM (Ollama) inference, traditional load testing (e.g., blasting the API with 10k requests) is not highly relevant for local deployments.
However, for the VLM specifically:
- A benchmark script is available at `backend/app/benchmark.py`.
- **Metrics:** It measures processing time per label, VLM hallucinations/retries, and accuracy against a golden dataset.

For the frontend, performance is heavily dictated by image manipulation (Blob/File creation) before upload. Lighthouse metrics should target >90 for Performance and Best Practices on the Vite build.
# Testing Strategy

## Automated Test Breakdown
* **Frontend Unit/Integration:** Powered by Vitest (`@vitest/runner`, `@vitest/mocker`, `@vitest/expect`)[cite: 1]. Tests deterministic insight rules, consumed-portion calculations, and UI rendering (`src/domain/pairing.test.ts`)[cite: 1].
* **Backend Unit:** Powered by Pytest. Tests cover image sanitization, deterministic nutrient validation (e.g., verifying sub-sugars do not exceed total sugars), and API routing. Run via `PYTHONPATH=backend pytest -q backend/tests`[cite: 1].

## Code Coverage & Linting
* **TypeScript Integrity:** Enforced via `@typescript-eslint/eslint-plugin`[cite: 1] and `tsc --noEmit`[cite: 1]. TypeScript is specifically enforced for Sugar pAI modules[cite: 1].
* **Static Analysis:** ESLint runs globally on all `.js`, `.ts`, and `.tsx` files via `npm run lint`[cite: 1].

## Load and Performance 
*(To be implemented)*
Future load testing will benchmark the VLM extraction timeout logic (`SUGAR_PAI_VISION_TIMEOUT_SECONDS`) against parallel HTTP requests using k6.
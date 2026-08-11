# System Limitations & Technical Debt

Proactively acknowledging system limitations is a core tenet of engineering maturity. This document outlines known bottlenecks, deferred features, and out-of-scope conditions for the current iteration of NutritionTracker (v1.3.x).

## Current Bottlenecks & Weaknesses

### 1. Vision-Language Model (VLM) Reliability
While the deterministic validation layer catches mathematically impossible outputs, the underlying VLM (e.g., `gemma4:12b`) is still prone to OCR failures on highly distorted, shiny, or partially obscured packaging. When the VLM hallucinates an entirely incorrect (but mathematically sound) value, the system relies entirely on the user's manual review to catch the error.

### 2. Ephemeral Daily Dozen State
The core Daily Dozen tracking state (calories, serving multipliers, and meal progress) is heavily reliant on transient React state and non-persistent memory, with only recipes and Sugar pAI history utilizing local storage persistence (`localStorage` and `IndexedDB`). A browser crash or accidental tab closure can lead to data loss for the current day's un-exported progress.

### 3. VLM Hardware Requirements
Running a 12-billion parameter model locally via Ollama requires significant RAM/VRAM. On lower-end machines, the analysis pipeline can exceed the `SUGAR_PAI_VISION_TIMEOUT_SECONDS`, leading to job failures and poor user experience.

## Deferred Features & Technical Debt

- **TypeScript Migration:** While the newer Sugar pAI frontend components were written in TypeScript, the original Daily Dozen dashboard components (e.g., `App.jsx`, `Dashboard.jsx`) remain in plain JSX. Unifying the entire frontend to strict TypeScript has been deferred.
- **Centralized Database Integration:** The lack of a relational cloud database (like PostgreSQL via Supabase or Firebase) prevents multi-device syncing.

## Out-of-Scope Conditions

- **Medical Advice:** The app is explicitly NOT a medical device. It does not provide diagnosis, treatment, insulin dosing, or individualized glucose prediction.
- **Licensed Nutritional Databases:** No licensed FNRI, Trinidad, or proprietary tested-product Glycemic Index tables are bundled within the app. All GI values calculated are heuristic estimates.
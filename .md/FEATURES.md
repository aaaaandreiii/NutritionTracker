# Functional Feature Catalog

This document provides an exhaustive, highly technical breakdown of every functional capability within NutritionTracker. It is designed for developers, technical panels, and QA engineers to understand exactly *how* features work, their inputs/outputs, edge cases, and workflow rules.

---

## 1. Daily Dozen Tracking Engine (Frontend)

The core tracker operates entirely on the client side, utilizing React state and `localStorage` for persistence.

### 1.1 Dashboard & Meal Logging
- **Capability:** Users can log food items into predefined meal slots (Breakfast, Morning Snack, Lunch, Afternoon Snack, Dinner).
- **Inputs:** Food items (from pantry, recipes, or manual entry), serving multipliers.
- **Outputs:** Recalculated total calories, macro/micro category progress (e.g., Beans, Berries, Greens), and real-time deficit updates.
- **Workflow Rules:**
  - Progress is calculated dynamically based on a custom target schema (`goalPresets`).
  - Items can be cleared per meal slot.
- **Edge Cases:** If an item contains zero calories or undefined serving values, the calculation engine treats them as `0` rather than throwing `NaN`.

### 1.2 Target Presets & Custom Overrides
- **Capability:** Users can select predefined dietary targets (e.g., "Standard Daily Dozen") or manually override specific category targets.
- **Inputs:** Preset selection string or custom integer overrides for specific categories.
- **Workflow Rules:** Switching presets overwrites custom overrides unless the user is actively in the configuration mode.

### 1.3 Pantry & Grocery Management
- **Capability:** Tracks available ingredients and their quantities, and allows moving items to a grocery list.
- **Workflow Rules:** 
  - Cooking a recipe automatically deducts required ingredients from the Pantry (if available).
  - Grocery items can be checked off and moved back to the Pantry.

---

## 2. Sugar pAI Extraction Pipeline (Backend & Frontend)

The AI-driven nutritional extraction pipeline relies on a multipart file upload to a FastAPI backend, which streams events back to the client.

### 2.1 Image Capture & Upload
- **Capability:** Users capture images of Nutrition Facts, Ingredients, and (optionally) the Front Packaging/Barcode.
- **Inputs:** Device Camera `MediaStream` (converted to blob) or file uploads.
- **Outputs:** `multipart/form-data` payload containing `nutrition_image`, `ingredient_image`, `front_image`, `market`, and `barcode`.
- **Workflow Rules:** The frontend halts camera streams immediately upon navigating away from the Sugar pAI tab to ensure privacy and conserve battery.
- **Edge Cases:** Unsupported file formats or images > 8MB are rejected by the backend with a `413` or `422` HTTP status.

### 2.2 Image Sanitization & Quality Checks
- **Capability:** The backend scrubs EXIF data and assesses image quality before processing.
- **Inputs:** Raw binary image data.
- **Outputs:** Sanitized temporary `.jpg` files and a list of quality check booleans (e.g., blur detection).

### 2.3 VLM Extraction (Ollama)
- **Capability:** Extracts structured nutritional data from images using a Vision-Language Model.
- **Inputs:** Sanitized images and an internal prompt schema.
- **Outputs:** Raw JSON representing extracted macros, serving sizes, and product names.
- **Edge Cases:** If the VLM hallucinates or returns invalid JSON, the backend's deterministic parsing layer catches it and issues a pipeline error event, prompting the user for a manual review/retry.

### 2.4 Ingredient Taxonomy Classification
- **Capability:** Analyzes the raw ingredients list to identify hidden sugars using a versioned taxonomy (`SUGAR_TAXONOMY_VERSION`).
- **Inputs:** Extracted raw ingredients text string.
- **Outputs:** A categorized list of `sugar_variants` (e.g., "Maltodextrin" -> Hidden Sugar).

### 2.5 Deterministic Validation & Glycemic Calculation
- **Capability:** Enforces mathematical consistency on the extracted data (e.g., `Total Carbs >= Total Sugars`).
- **Inputs:** Finalized extraction request payload from the user.
- **Outputs:** `LabelRecordValidationResponse` containing validated `NutrientFields`, `glycemic` evidence, and strict validation checks (Pass/Fail).
- **Workflow Rules:** A record *cannot* be saved to IndexedDB unless it passes all critical validation checks.

### 2.6 Local Storage & Export
- **Capability:** Saves confirmed label analyses locally to the browser.
- **Inputs:** Confirmed `AnalysisResult` JSON.
- **Outputs:** IndexedDB records, accessible via the History tab. Exportable as CSV or JSON.
- **Workflow Rules:** Images are discarded by the backend after processing. Local storage of images is opt-in only.

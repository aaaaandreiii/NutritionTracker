# Functional Feature Catalog

This catalog describes the implemented Sugar pAI V2 behavior. Sugar pAI is the primary product surface; Daily Dozen remains available as supporting local tracking.

## 1. Sugar pAI Packaged-Label Flow

### 1.1 Barcode-First Capture and Image Quality
- **Capability:** Start packaged-label analysis from a prominent live UPC/EAN scanner, typed barcode, or uploaded barcode photo; capture Nutrition Facts, ingredients, and front-label images when database data is partial or missing.
- **Inputs:** JPEG, PNG, or WebP files for image-based analysis. Nutrition Facts is required only when no complete local barcode database match is used.
- **Outputs:** Local image quality checks, local barcode detection state, optional local database lookup preview, and a backend upload or barcode-only analysis request.
- **Workflow rules:** Camera streams are stopped when leaving Sugar pAI. Backend uploads are capped at 8 MB per image and stripped of EXIF metadata.

### 1.2 Local Barcode Lookup
- **Capability:** Query a generated local Open Food Facts Philippines SQLite database by UPC/EAN before running image extraction.
- **Inputs:** Numeric barcode and `market=PH`.
- **Outputs:** `OffProductLookupResponse` with found/partial/missing status, missing field list, product/nutrient preview, ingredient text, and qualitative database markers such as NOVA, Nutri-Score, and allergens.
- **Workflow rules:** Complete local records can open `EvidenceReview` without images through `POST /api/v1/analyses/barcode`. Partial records guide the user to capture missing Nutrition Facts and ingredients panels. Database values are marked `sourceKind: "database"` and still require final user confirmation.

### 1.3 VLM Extraction and Evidence Review
- **Capability:** Use the backend VLM pipeline to draft label fields, then require user review before confirmation.
- **Inputs:** Sanitized package-panel images, market, optional barcode, and optional local database fallback.
- **Outputs:** `AnalysisResult` with evidence values, confidence, provenance, validation checks, diagnostics, limitations, sugar variants, and glycemic evidence.
- **Workflow rules:** Blank values remain unknown. Sample values are never substituted when extraction fails. Complete local database matches skip VLM; partial local matches can provide fallback values while VLM reads supplied label photos.

### 1.4 Deterministic Validation
- **Capability:** Validate reviewed label values using backend rules.
- **Inputs:** `FinalizeRequest` with product name, serving basis, nutrient fields, raw ingredients, and consumed servings.
- **Outputs:** Confirmed `AnalysisResult` or `LabelRecordValidationResponse`.
- **Workflow rules:** Records cannot be saved until validation passes. Missing fields remain `Unavailable`; no missing field is converted to zero.

### 1.5 Glycemic Evidence Policy
- **Capability:** Display sourced GI only when permitted matched source data exists; otherwise keep `sourced` unavailable.
- **Current implementation:** No licensed FNRI, Trinidad, or tested-product GI table is bundled. Packaged-label records may show only clearly labeled `heuristic_demo` GL when required current-label/user-confirmed inputs are present.
- **Workflow rules:** Demo GL bands remain labeled as demo context and do not predict individual glucose response.

## 2. Smart Context

### 2.1 Shared Smart Context Input
- **Capability:** Build deterministic context insights from either packaged-label records or curated unlabeled demo records.
- **Types:** `SmartContextRecordKind`, `SmartContextInput`, `CuratedFoodRecord`, and backward-compatible `LogEntry` handling.
- **Workflow rules:** Smart Context appears only after backend validation.

### 2.2 Context Insights
- **Capability:** Show context rules for fiber, protein/fat, food order, sugar context, ingredient context, movement education, and data limits.
- **Outputs:** Insight title, body, evidence labels, source links when applicable, and concise action chips.
- **Workflow rules:** Movement copy is optional education. Smart Context does not provide medical advice or glucose prediction.

### 2.3 Ingredient Context Flags
- **Capability:** Surface ingredient flags as first-class context.
- **Flags:** Sugar aliases, high-fructose corn syrup, maltodextrin, starches, polyols, high-intensity sweeteners, and processing markers.
- **Workflow rules:** Flags are descriptive evidence context, not food ratings or suitability claims.

## 3. Curated Unlabeled Filipino-Food Demo

### 3.1 Catalog
- **Capability:** List allowed Filipino demo foods for `market=PH`.
- **Endpoint:** `GET /api/v1/unlabeled-foods/catalog?market=PH`
- **Data included:** Food ID, display name, aliases, portion labels, qualitative tags, limitations.
- **Data excluded:** Authoritative calories, macros, GI, GL, and FNRI-derived claims.

### 3.2 Candidate Identification
- **Capability:** Accept a food image and return curated catalog candidates when a demo alias hint can be found.
- **Endpoint:** `POST /api/v1/unlabeled-foods/identify`
- **Workflow rules:** Vision/candidate output is only a suggestion. If no candidate is found, the UI falls back to manual catalog selection.

### 3.3 Record Validation
- **Capability:** Validate selected catalog food and portion.
- **Endpoint:** `POST /api/v1/unlabeled-food-records/validate`
- **Outputs:** `CuratedFoodRecord` with qualitative tags, context flags, unavailable glycemic evidence, limitations, and provenance.
- **Workflow rules:** Smart Context appears only after this validation response.

## 4. Local History and Export

- **Capability:** Store confirmed records in browser IndexedDB and export JSON/CSV without retained images.
- **Packaged-label records:** Store `result`; missing `kind` is treated as legacy `packaged_label`.
- **Curated demo records:** Store `curatedRecord`, context-only totals, and no retained source images.
- **Workflow rules:** Source images are retained only by explicit opt-in for packaged-label records.

## 5. Daily Dozen Support

Daily Dozen dashboard, pantry, grocery, recipe, and meal logging remain available. Sugar pAI records can add local meal-slot snapshots, but Daily Dozen is secondary to the Sugar pAI V2 evidence and Smart Context story.

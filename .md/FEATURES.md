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
- **Inputs:** Numeric barcode and `market=PH`; 12-digit UPC-A values and zero-prefixed EAN-13 values are treated as equivalent lookup candidates.
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

### 1.6 Evidence Semantics
- **Capability:** Preserve how every value was obtained and changed without breaking legacy response fields.
- **Types:** `EvidenceValue` retains `sourceKind`, status, evidence reference, confidence, conflict, and confirmation. It adds `evidenceType`, optional numeric `range`, `confidenceBand`, timestamped `evidenceTrail`, and source metadata.
- **Evidence types:** `observed`, `retrieved`, `estimated`, `derived`, `contextual`, and `unavailable`.
- **Workflow rules:** Missing values carry unavailable evidence and remain unknown. Database retrieval, photographed-label observation, user confirmation, and deterministic derivation remain distinguishable in saved records and exports.

## 2. Smart Context

### 2.1 Backend Smart Context Resolution
- **Capability:** Resolve packaged labels, legacy curated records, and estimated meals through `POST /api/v1/smart-context/resolve`.
- **Inputs:** Normalized record kind, market, meal, portion, exact values or ranges, evidence/source IDs, qualitative tags, context flags, limitations, and excluded-component count.
- **Outputs:** Triggered rule IDs, validated cards, actions, evidence/source IDs, source snapshots, generation mode, warnings, and rule/evidence/pairing/writer/cache provenance.
- **Workflow rules:** Deterministic rules decide which context applies. The frontend shows deterministic cards immediately, then replaces them only with a validated backend response. Saved logs retain the final snapshot.

### 2.2 Context Insights
- **Capability:** Show context rules for fiber, protein/fat, food order, sugar context, ingredient context, movement education, estimate boundaries, uncertainty boundaries, and data limits.
- **Outputs:** Insight title, body, evidence labels, source links when applicable, and concise action chips.
- **Workflow rules:** An estimated nutrient rule triggers only when the complete min–max range supports its threshold. A range that crosses a threshold produces an uncertainty/data-quality card instead. Movement copy is optional education. Smart Context does not provide medical advice or glucose prediction.

### 2.3 Grounded Writer and Cache
- **Capability:** Optionally ask Ollama to rewrite only supplied deterministic cards, facts, actions, and citations into structured JSON.
- **Validation:** Unknown rule/evidence/source IDs, changed actions, invented numbers, duplicated rules, prohibited health/suitability/medication/glucose claims, invalid JSON, timeout, or network failure all preserve deterministic copy.
- **Cache key:** Normalized record, meal, portion, market, evidence values, and rule/evidence/pairing/writer/model versions.
- **Runtime:** Writer mode is disabled by default and never blocks deterministic Smart Context.

### 2.4 Ingredient Context Flags
- **Capability:** Surface ingredient flags as first-class context.
- **Flags:** Sugar aliases, high-fructose corn syrup, maltodextrin, starches, polyols, high-intensity sweeteners, and processing markers.
- **Workflow rules:** Flags are descriptive evidence context, not food ratings or suitability claims.

### 2.5 Context Snack Pairings
- **Capability:** Show a compact `Pair with this snack` section inside the packaged-label Context page after the primary Smart Context and ingredient/processing context.
- **Inputs:** The user-confirmed packaged product record, including product name, serving identity, raw ingredients, and evidence status. Nutrient values are not required for V1 pairing eligibility and are never modified by this feature.
- **Outputs:** Up to four controlled companion-food ideas with neutral labels, concise rationale, and an expandable evidence/provenance panel.
- **V1 options:** Peanut butter, plain yogurt, cheese, and whole fruit.
- **Eligibility:** Deterministic rules classify conservative snack-like contexts such as crackers, biscuits, bread, cereal-type snacks, and sweet snack labels. Unknown categories produce no invented recommendations.
- **Self-filtering:** If the scanned product already appears to be yogurt, peanut butter, cheese, or whole fruit, that same food is removed from the suggestion set.
- **Evidence model:** The UI separates `Product evidence · Strong` for the confirmed scanned product from `Supporting evidence · Moderate` for general snack and satiety literature. Supporting evidence is not represented as product-specific research for the scanned item.
- **Workflow rules:** The section is passive Context UI, not a chatbot. It does not add items to Estimated Meal, impute missing nutrients, recalculate product values, claim glucose outcomes, or label foods as healthy, safe, better, or diabetes-friendly.

## 3. Estimated Unlabeled Meals

### 3.1 Photo or Manual Draft
- **Capability:** Start a short-lived `market=PH` meal-analysis job from one food photo or a manual food description.
- **Endpoints:** `POST /api/v1/unlabeled-meal-analyses` and `GET /api/v1/unlabeled-meal-analyses/{id}/events`.
- **Vision output:** Up to 12 food components containing identity, visible preparation clues, household portion, 1–5000 g visual range, and confidence. The strict VLM schema rejects calories, macros, GI, GL, and glucose claims.
- **Fallback:** Vision failure leaves manual food search and the curated Filipino-food catalog available.

### 3.2 USDA Identity Correction
- **Capability:** Search USDA FoodData Central for up to five candidate records per component.
- **Endpoint:** `GET /api/v1/food-data/search?q=...&limit=5`.
- **Workflow rules:** `USDA_FDC_API_KEY` remains server-side. Users can remap a component or mark it context-only when no credible match exists. Missing credentials return an explicit unavailable response rather than blocking the flow.

### 3.3 Confirmation and Calculation
- **Capability:** Confirm every remaining component, food identity, database match or context-only status, household portion, and gram range.
- **Endpoint:** `POST /api/v1/unlabeled-meal-analyses/{id}/finalize`.
- **Calculation:** Each available USDA per-100-g nutrient is multiplied by the confirmed minimum and maximum grams. The midpoint is presentation-only and shown with `~`; missing nutrients remain unknown.
- **Partial meals:** Aggregate ranges sum matched components only. Records include matched/excluded counts, per-nutrient unknown counts, `partial`, limitations, candidate/source snapshots, and timestamped evidence trails.
- **Cleanup:** Finalize and `DELETE /api/v1/unlabeled-meal-analyses/{id}` delete backend image files. Unfinished jobs expire after 15 minutes.

### 3.4 Curated Qualitative Fallback and Legacy Compatibility
- **Capability:** Keep the Filipino-food catalog inside the estimated-meal UI as a context-only fallback.
- **Legacy endpoints:** `GET /api/v1/unlabeled-foods/catalog`, `POST /api/v1/unlabeled-foods/identify`, and `POST /api/v1/unlabeled-food-records/validate` remain available for existing clients and saved `curated_unlabeled_demo` logs.
- **Boundary:** Curated/context-only components provide descriptors and limitations only. They are excluded from numeric meal aggregates and never receive calories, macros, GI, GL, or FNRI-derived claims.

## 4. Evidence Chat

- **Capability:** `#/sugar-pai/ask` provides an evidence-grounded chat surface for general nutrition-label questions or questions about one selected local packaged-label record.
- **Inputs:** A user question, up to ten prior local turns, and an optional minimal product snapshot built from a validated local log.
- **Outputs:** POST-SSE events for retrieval/generation stage, source snapshots before answer text, streamed Markdown deltas, completion, or retryable errors.
- **Source UI:** Answers can expose interactive citations, active-source highlighting, mobile evidence sheet behavior, and focus mode. Source snapshots include relationship, strength, publisher/domain, URL, and a concise supporting excerpt.
- **Local persistence:** Thread titles, messages, selected product context, sources, warnings, and state are stored in browser IndexedDB under `chatThreads`.
- **Workflow rules:** Safety refusals, out-of-scope answers, and no-evidence answers are deterministic. Tavily is optional and restricted to authoritative domains; missing Tavily falls back to curated retrieval. The backend does not persist chat conversations.
- **Boundary:** Evidence chat is separate from the packaged-label `Pair with this snack` Context section. The Context section renders controlled pairings directly and does not ask chat to generate them.

## 5. Local History and Export

- **Capability:** Store confirmed records in browser IndexedDB and export JSON/CSV without retained images.
- **Packaged-label records:** Store `result`; missing `kind` is treated as legacy `packaged_label`.
- **Estimated meal records:** Store one `estimated_unlabeled_meal` with nested confirmed components, USDA snapshots, component/aggregate ranges, unknown/excluded counts, limitations, and a Smart Context snapshot.
- **Curated demo records:** Existing `curatedRecord` logs remain readable with context-only totals.
- **Today totals:** Exact values behave as fixed ranges. Estimated values contribute min–max ranges and `~midpoint` summaries. Combined totals remain marked estimated/partial and count unknown or excluded components.
- **Workflow rules:** Estimated records are read-only in this release. Source photos are retained only by explicit local opt-in. JSON excludes blobs; CSV includes midpoint, min, max, excluded count, and partial status.

## 6. Daily Dozen Support

Daily Dozen dashboard, pantry, grocery, recipe, and meal logging remain available. Sugar pAI records can add local meal-slot snapshots, but Daily Dozen is secondary to the Sugar pAI V2 evidence and Smart Context story.

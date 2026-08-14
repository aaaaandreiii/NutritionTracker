# Changelog

All notable changes to the project are documented here.

## [Unreleased] - Evidence-Aware Estimated Meals

### Added
- `estimated_unlabeled_meal` records with nested confirmed components, USDA source snapshots, portion/nutrient ranges, unknown/excluded counts, limitations, and provenance.
- Extended evidence types, ranges, confidence bands, source metadata, and timestamped trails while retaining legacy evidence fields.
- Strict Ollama meal-image schema limited to 12 components and prohibited from returning calories, macros, GI/GL, health claims, or glucose predictions.
- Server-only USDA FoodData Central search/details integration with five-candidate limits, nutrient mapping, caching, timeouts, and missing-key fallback.
- Estimated-meal job endpoints, SSE stages, component finalization, and explicit cleanup.
- Backend Smart Context resolver with range-aware deterministic rules, Philippine pairing examples, evidence/source snapshots, optional grounded writing, validation, caching, and fallback provenance.
- Estimated-meal Today/History displays, fixed-plus-range aggregation, nested JSON/CSV export fields, read-only detail drawer, and explicit local meal-photo retention.
- Automated coverage for USDA calculations, strict meal schema, partial meals, Smart Context boundaries/safety/cache, manual estimated meals, multi-item photo editing, and mobile overflow.

### Changed
- Replaced the current filename-based unlabeled UI with photo/search → component confirmation → estimated breakdown → Smart Context → local save.
- Kept the curated Filipino-food catalog within the new flow as a qualitative context-only fallback.
- Packaged-label Smart Context now resolves through the backend asynchronously while preserving immediate deterministic browser cards.
- Saved packaged and estimated logs retain final Smart Context card/source/version snapshots for reproducible History.
- Today combines exact values as fixed ranges and estimated values as min–max ranges; unknown and partial totals remain explicit.
- Playwright runs serially to make route mocks and full-page responsive screenshots deterministic.

### Guardrails
- Only USDA per-100-g data and user-confirmed gram endpoints originate estimated nutrient ranges.
- Missing nutrients remain unknown; context-only components never contribute numeric totals.
- Estimated meals never receive numeric GI/GL or personal glucose predictions.
- Backend meal images are deleted on finalize/delete/expiry; browser retention remains opt-in.
- Writer/model/search failure cannot suppress deterministic Smart Context.

## [v2.1.0] - Offline Barcode Lookup

### Added
- Generated local Open Food Facts Philippines SQLite database at `backend/app/data/off_ph_products.db`.
- CSV ingest script `backend/app/db/ingest_off.py` for `research/openfoodfacts_export.csv`.
- Local barcode lookup endpoint `GET /api/v1/off-products/{barcode}?market=PH`.
- Barcode-only analysis endpoint `POST /api/v1/analyses/barcode` for complete local database matches.
- UPC-A and zero-prefixed EAN-13 barcode aliases resolve to the same local database row.
- Live ZXing camera barcode scanner modal with detected/not-detected state.
- Image-free evidence review support for complete database-prefilled matches.

### Changed
- Image-based packaged-label analysis now checks the local OFF database before running VLM.
- Complete local barcode matches skip VLM and open user review with `sourceKind: "database"` evidence.
- Partial local barcode matches keep database values as fallback evidence while VLM reads submitted label photos.
- OFF `ingredients_text_en` is used for raw ingredient context and existing sugar taxonomy classification.

### Guardrails
- Added sugars remain unknown when not declared in package-level OFF fields.
- NOVA, Nutri-Score, allergens, categories, and labels remain descriptive database context only.
- User confirmation through finalize remains required before local logging.

## [v2.0.0] - Sugar pAI Product Consolidation

### Added
- Sugar pAI-first default route at `#/sugar-pai/scan`.
- Packaged label / Unlabeled demo mode switch.
- Curated Filipino-food demo catalog for `market=PH`.
- Backend endpoints:
  - `GET /api/v1/unlabeled-foods/catalog?market=PH`
  - `POST /api/v1/unlabeled-foods/identify`
  - `POST /api/v1/unlabeled-food-records/validate`
- Shared Smart Context input adapters for packaged-label and curated demo records.
- Curated demo local logs with `kind: "curated_unlabeled_demo"`.
- Backward-compatible log handling where missing `kind` is treated as packaged-label.
- First-class ingredient context flags for sugar aliases, HFCS, maltodextrin, starches, polyols, high-intensity sweeteners, and processing markers.
- Smart Context action chips and source-preserving insight UI.

### Changed
- Repositioned Daily Dozen as supporting tracking rather than the primary product story.
- Renamed Pairing Engine UI copy to Smart Context.
- Made Smart Context prominent after backend validation and before local save.
- Updated README, research docs, app title, and manifest to Sugar pAI V2 positioning.
- Reworded claim-boundary language away from food permission claims.

### Guardrails
- Curated unlabeled demo records do not display calories, macros, GI, GL, or FNRI-derived claims.
- Packaged-label GL remains clearly labeled as `heuristic_demo` unless future licensed GI data exists.
- Unknown label values remain unknown.

## [v1.3.0] - Sugar pAI Backend Integration

### Added
- FastAPI research backend for packaged-food VLM extraction.
- Camera capture workflow under `#/sugar-pai/scan`.
- Ollama VLM support.
- Versioned sugar taxonomy engine.
- Deterministic label validation.
- IndexedDB storage for confirmed packaged-label records.
- Docker Compose orchestration.

### Fixed
- Camera streams stop when navigating away from Sugar pAI.

## [v1.2.0] - Daily Dozen Presets and Overrides

### Added
- Goal preset system.
- Custom manual target overrides.

## [v1.1.0] - Recipe and Pantry Sync

### Added
- Pantry deduction from cooked recipes.
- Grocery list generation from missing ingredients.

## [v1.0.0] - Initial Release

### Added
- Core Daily Dozen tracking UI.
- Local storage persistence for custom recipes.
- Basic meal slot categorization.

# Changelog

All notable changes to the project are documented here.

## [Unreleased] - Offline Barcode Lookup

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

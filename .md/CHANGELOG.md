# Changelog

All notable changes to the NutritionTracker project will be documented in this file.

## [v1.3.0] - Integration of Sugar pAI Backend

### Added
- **Sugar pAI Integration:** Merged the FastAPI research backend into the core repository to provide Vision-Language Model (VLM) extraction capabilities for packaged food labels.
- **Camera Capture Workflow:** Added a unified frontend UI under `#/sugar-pai/scan` to allow users to capture Nutrition Facts and Ingredient lists using their device camera or via file upload.
- **Local VLM Support:** Configured the backend to support Ollama (defaulting to `gemma4:12b`) for private, local LLM inference without requiring external API keys.
- **Taxonomy Engine:** Introduced a versioned sugar taxonomy engine to classify and detect hidden sugar aliases in ingredient lists.
- **Deterministic Validation Layer:** Implemented strict Pydantic-based arithmetic validation to cross-check VLM outputs (e.g., ensuring `Total Carbohydrates >= Total Sugars`).
- **IndexedDB Persistence:** Added robust local browser storage for confirmed Sugar pAI records, accessible via the new `#/sugar-pai/history` route.
- **Docker Compose:** Added comprehensive Docker orchestration (`docker-compose.yml`, `Dockerfile.frontend`, `backend/Dockerfile`) to easily spin up the combined stack.

### Changed
- **Dashboard UI Update:** Revamped the top navigation to include the `Sugar pAI` tab alongside existing `Dashboard`, `Pantry`, and `Recipes` tabs.
- **State Management:** Enhanced the React state manager to seamlessly integrate the transient Daily Dozen tracking state with the persistent Sugar pAI data models.

### Fixed
- **Camera Resource Leak:** Implemented a state-driven camera monitor that automatically shuts down active `MediaStream` tracks when navigating away from the Sugar pAI tab to conserve battery.

## [v1.2.0] - Daily Dozen Presets and Overrides
### Added
- Goal preset system allowing users to select dietary protocols (e.g., "Standard Daily Dozen").
- Custom manual overrides for specific nutritional categories.

## [v1.1.0] - Recipe and Pantry Sync
### Added
- Pantry deducting logic: Cooking a saved recipe automatically reduces the corresponding ingredient quantities from the Pantry.
- Grocery list generation directly from recipe missing ingredients.

## [v1.0.0] - Initial Release
### Added
- Core Daily Dozen tracking UI.
- Local storage persistence for custom recipes.
- Basic meal slot categorization (Breakfast, Lunch, Dinner, Snacks).
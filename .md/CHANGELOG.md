# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
* IndexedDB integration for persistent storage of Today/History Sugar pAI records.
* CSV/JSON export functionality for local scanning history.

### Changed
* Transitioned packaged-food logging to add lightweight snapshots (0 calories, no category progress impact) to Daily Dozen meal slots.

## [1.1.0] - 2026-08-11
### Added
* **Sugar pAI MVP:** Introduced a VLM-backed (Vision-Language Model) label analysis pipeline via FastAPI.
* Support for local barcode decoding (UPC/EAN) and optional Open Food Facts lookups.
* Real-time streaming of backend stages (image checks, extraction, validation).

### Changed
* Merged the legacy Daily Dozen frontend-only tracker with the new Sugar pAI backend into a unified app shell[cite: 1].

### Fixed
* Resolved the calorie field mapping discrepancy where Sugar pAI payloads used `cals` but the intake pipeline expected `totalCals`[cite: 1]. 

### Deprecated
* Simulated external machine learning APIs and mock timeout delays have been replaced by the actual local Ollama API implementation[cite: 1].
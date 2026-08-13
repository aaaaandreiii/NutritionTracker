# Project Roadmap

Sugar pAI V2 is now the primary product direction: packaged-label evidence validation, deterministic Smart Context, and qualitative curated demo support for unlabeled Filipino foods. Daily Dozen remains a supporting local tracker.

## Phase 1: Stabilize V2

- **Smart Context UX QA:** Verify packaged-label and curated demo flows across mobile and desktop, including text fit, drawer behavior, and context flag readability.
- **Barcode-first QA:** Exercise live UPC/EAN scanner behavior, typed barcode lookup, complete database match review, and partial/missing match capture guidance across mobile and desktop.
- **Catalog governance:** Add review workflow for curated Filipino-food entries, aliases, portion labels, qualitative tags, and limitations.
- **Backend API hardening:** Add rate limits, request logging hooks, and stricter upload MIME validation for public deployments.
- **Frontend TypeScript migration:** Convert legacy Daily Dozen JSX components to strict TypeScript.
- **Daily Dozen persistence:** Move transient Daily Dozen meal state into durable local storage.

## Phase 2: Evidence and Benchmark Expansion

- **Packaged-label benchmark:** Build the private 100-product gold set described in `research/README.md`.
- **Extraction quality gates:** Keep VLM output as draft until exact-match, sugar-alias, schema-validity, cost, and latency gates pass.
- **OFF database benchmark:** Track local barcode hit rate, completeness rate, missing-field distribution, and disagreement rate versus photographed current labels.
- **Ingredient flag review:** Expand tests for sugar aliases, HFCS, maltodextrin, starches, polyols, high-intensity sweeteners, and processing markers.
- **Curated demo evaluation:** Track whether users can correctly confirm food and portion after photo hints, including manual fallback rate.

## Phase 3: Permitted Data Integrations

- **Licensed GI/FNRI path:** Add sourced GI or authoritative Filipino nutrition data only after licensing, provenance, and matching rules are resolved.
- **Barcode/database expansion:** Expand beyond the generated PH Open Food Facts SQLite artifact only with clear provenance, refresh automation, and schema-drift tests.
- **Reporting:** Improve CSV/JSON exports for packaged-label evidence, curated demo context, and Daily Dozen support snapshots.

## Out of Scope Until Evidence Exists

- Numeric GI/GL for curated unlabeled demo foods.
- Authoritative calories/macros for curated Filipino foods.
- Personalized glucose prediction.
- Medication, insulin, diagnosis, or treatment guidance.
- Food permission or suitability claims.

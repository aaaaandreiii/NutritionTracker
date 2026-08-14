# Project Roadmap

Sugar pAI V2 now supports packaged-label evidence, USDA-backed estimated meal ranges, deterministic backend Smart Context, and a qualitative Philippine-food fallback. Daily Dozen remains a supporting local tracker.

## Implemented Foundation

- Barcode-first PH Open Food Facts lookup with package-label confirmation.
- Strict label and meal-image schemas with deterministic validation.
- Multi-component estimated meals with user-confirmed USDA identity and portion ranges.
- Honest partial aggregates, unknown counts, evidence trails, and local range exports.
- Backend range-aware Smart Context, constrained PH pairings, optional validated writing, caching, and saved snapshots.
- Qualitative context-only fallback when vision or USDA is unavailable.
- Local-only packaged, legacy curated, estimated-meal, and chat history.

## Phase 1: Stabilize the Estimated-Meal Release

- **Live service evaluation:** Run controlled tests against the pinned Ollama meal model and USDA production API; report schema-valid-after-retry rate, component identity accuracy, candidate acceptance/remap rate, latency, and failure reasons.
- **Portion UX research:** Measure whether users understand household measures, gram min/max, midpoint notation, context-only exclusion, and partial-total warnings.
- **Mobile/accessibility QA:** Audit component controls and estimated History drawers at 375, 430, 768, 1024, 1440, and 1920 px, including keyboard navigation, screen-reader labels, focus order, and 44 px touch targets.
- **Rule governance:** Add review/version tooling for thresholds, evidence bundles, allowed categories, Philippine pairings, and source deprecation.
- **Operational hardening:** Add endpoint-specific rate limiting, restricted CORS, structured redacted monitoring, and a shared job/cache store before public multi-worker deployment.
- **Frontend TypeScript migration:** Convert remaining legacy Daily Dozen JSX components to strict TypeScript.

## Phase 2: Evidence and Benchmark Expansion

- **Packaged-label benchmark:** Complete the private 100-product gold set described in `research/README.md`.
- **Meal-image benchmark:** Build a consented, non-clinical PH meal-photo set with component identity, preparation-clue, and portion-range annotations; nutrients remain independently calculated from confirmed database matches.
- **USDA matching benchmark:** Measure top-1/top-5 candidate recall, user remap rate, generic/branded mismatch rate, nutrient missingness, cache performance, and schema drift.
- **Partial-meal honesty evaluation:** Test whether users can distinguish matched-component subtotals from complete-meal totals.
- **Smart Context evals:** Test range-boundary behavior, source/action preservation, prohibited-claim rejection, cache invalidation, and deterministic fallback across model/search failure modes.
- **OFF refresh automation:** Track local barcode hit/completeness/disagreement rates and add repeatable refresh/schema-drift checks.

## Phase 3: Permitted Data and Product Scaling

- **Authoritative Philippine nutrition path:** Add FNRI or other local nutrient data only after licensing, provenance, versioning, and exact matching rules are resolved.
- **Licensed GI path:** Add sourced GI only with permitted tested-food records and transparent match levels. Estimated unlabeled meals remain ineligible for numeric GI/GL unless a separately validated methodology is approved.
- **Recipe-aware estimates:** Consider explicit user-authored recipes and ingredient weights; do not infer hidden recipes from a photo.
- **Optional sync:** Design authenticated, encrypted multi-device sync only after consent, deletion, export, tenant isolation, and retention requirements are defined.
- **Reporting:** Add source/evidence audit views and longitudinal exports without turning educational estimates into clinical tracking.

## Out of Scope Until Separate Evidence and Governance Exist

- Personal glucose prediction or claims that a food will spike/lower glucose.
- Medication, insulin, diagnosis, treatment, allergy, or food-suitability guidance.
- Numeric GI/GL for estimated unlabeled meals.
- Hidden-ingredient or exact-recipe inference from a photograph.
- Treating USDA population/database values as laboratory truth for the photographed meal.
- Long-term backend user storage by default.

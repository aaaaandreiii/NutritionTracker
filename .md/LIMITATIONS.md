# System Limitations and Technical Debt

This document captures known V2 limits for Sugar pAI and its supporting Daily Dozen tracker.

## Current Limits

### VLM Reliability

The label VLM can misread distorted, shiny, cropped, low-contrast, or multi-column labels. Meal vision can misidentify foods, merge separate components, miss sauces/toppings, or propose a poor household portion/range. Deterministic schemas and validation prevent the meal VLM from supplying macros, but user confirmation remains required for every accepted identity and portion.

### Local Open Food Facts Coverage

The bundled Open Food Facts SQLite database is generated from the available Philippines CSV export. Many rows are partial, community-contributed, or missing serving-level nutrients and ingredients. Complete matches can prefill review, but they are not treated as user-confirmed label truth until finalize.

### No Licensed GI Dataset

No licensed FNRI, Trinidad, or proprietary tested-product GI table is bundled. `sourced` GI remains unavailable until permitted data and matching rules are added. Packaged-label demo GL is explicitly `heuristic_demo`.

### Estimated Meals Are Not Laboratory Nutrition Analysis

Estimated meal nutrients use the user-confirmed gram endpoints and the selected USDA record's available per-100-g values. The range represents portion uncertainty only. It does not represent recipe variation, cooking loss/gain, laboratory uncertainty, population variance, hidden ingredients, sauce/oil absorption, or the actual chemical composition of the photographed serving.

USDA matches may describe a similar generic or branded food rather than the exact recipe. Missing nutrients remain unknown. Context-only and unresolved components are excluded from aggregates; therefore a partial aggregate must not be interpreted as a complete-meal total.

### USDA and Optional-Service Availability

FoodData Central requires a server-only key and network access. With no key, estimated-meal numeric matching is unavailable and the flow uses qualitative fallback. Ollama, Tavily, and Smart Context writing are also optional. Deterministic Smart Context and the curated catalog remain available, but no offline USDA nutrient cache is bundled.

### Curated Filipino-Food Fallback Is Qualitative

The catalog contains allowed food names, aliases, portion labels, qualitative tags, and limitations only. It does not provide authoritative calories, macros, GI, GL, or FNRI-derived claims. Legacy filename-alias identification remains an API compatibility route but is no longer the current estimated-meal UI identification method.

### Context Snack Pairings Are Controlled V1 Guidance

The `Pair with this snack` section uses a small deterministic configuration, not personalization, allergy filtering, dynamic web search, or LLM-generated recommendations. V1 supports a limited set of companion ideas for conservative snack-like packaged products: peanut butter, plain yogurt, cheese, and whole fruit.

Eligibility currently uses product name and ingredient text rather than a complete product taxonomy. Unknown categories omit the section. General supporting sources do not prove that a pairing was studied with the exact scanned product, and the feature never changes scanned-product nutrients, ingredients, NOVA, or Nutri-Score.

### Local-Only History

Sugar pAI history, range/source snapshots, retained opt-in photos, and Smart Context snapshots are stored in browser IndexedDB. Clearing browser data removes them. Multi-device sync and server recovery are not implemented. Estimated records are read-only; changes require delete and recreate.

### Daily Dozen State

The original Daily Dozen components still rely partly on transient React state and localStorage. Durable IndexedDB persistence for all meal state remains deferred.

### Backend Storage

The backend uses in-memory analysis jobs and temporary files for user data. The local Open Food Facts SQLite file is a static generated dataset, not a user-record database. The backend remains appropriate for local/research deployments, not multi-user durable job queues.

## Technical Debt

- Convert legacy JSX Daily Dozen components to TypeScript.
- Add stronger public-deployment rate limits and auth options.
- Add live-service contract tests against a controlled USDA sandbox/key and pinned Ollama model; current automated tests mock external network/model behavior.
- Add barcode-camera end-to-end tests with mocked camera permissions and ZXing decode results.
- Automate OFF export refresh and schema-drift checks.
- Add governance and review/version tooling for Filipino-food aliases, Smart Context pairings, Context snack-pairing options, rule thresholds, evidence bundles, and source deprecation.
- Add durable distributed job/cache storage before any multi-worker backend deployment.
- Add performance/load budgets for a 12-component meal when USDA details must be fetched for every component.
- Improve accessibility and mobile QA for History drawers and dense Smart Context cards.

## Out of Scope

- Medical advice, diagnosis, treatment, medication, or insulin guidance.
- Individual glucose prediction.
- Suitability or permission-style food claims.
- Numeric GI/GL for curated foods or estimated unlabeled meals.
- Authoritative Filipino nutrition values without a permitted dataset.
- Allergy filtering or recipe-level hidden-ingredient inference.
- Personalized or AI-generated snack recommendation catalogs.
- Clinical personalization or long-term backend user storage.

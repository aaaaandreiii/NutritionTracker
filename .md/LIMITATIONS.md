# System Limitations and Technical Debt

This document captures known V2 limits for Sugar pAI and its supporting Daily Dozen tracker.

## Current Limits

### VLM Reliability

The VLM can misread distorted, shiny, cropped, low-contrast, or multi-column labels. Deterministic validation catches impossible arithmetic and schema violations, but user review remains required for every accepted packaged-label record.

### No Licensed GI Dataset

No licensed FNRI, Trinidad, or proprietary tested-product GI table is bundled. `sourced` GI remains unavailable until permitted data and matching rules are added. Packaged-label demo GL is explicitly `heuristic_demo`.

### Curated Unlabeled Demo Is Qualitative

The Filipino-food catalog contains allowed demo foods, aliases, portion labels, qualitative tags, and limitations only. It does not provide authoritative calories, macros, GI, GL, or FNRI-derived claims.

### Local-Only History

Sugar pAI history is stored in browser IndexedDB. Clearing browser data removes local records. Multi-device sync is not implemented.

### Daily Dozen State

The original Daily Dozen components still rely partly on transient React state and localStorage. Durable IndexedDB persistence for all meal state remains deferred.

### Backend Storage

The backend uses in-memory analysis jobs and temporary files. It is appropriate for local/research deployments, not multi-user durable job queues.

## Technical Debt

- Convert legacy JSX Daily Dozen components to TypeScript.
- Add stronger public-deployment rate limits and auth options.
- Add end-to-end browser tests for packaged-label and curated demo flows.
- Add catalog governance for Filipino-food aliases, portions, and limitations.
- Improve accessibility and mobile QA for History drawers and dense Smart Context cards.

## Out of Scope

- Medical advice, diagnosis, treatment, medication, or insulin guidance.
- Individual glucose prediction.
- Suitability or permission-style food claims.
- Numeric GI/GL for curated unlabeled demo foods.
- Authoritative Filipino nutrition values without a permitted dataset.

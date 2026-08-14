# Testing Strategy

Sugar pAI V2 uses Vitest for frontend domain/storage logic, pytest for backend unit/API behavior, and Playwright for responsive browser workflows. External USDA, Ollama, and Tavily behavior is mocked in automated tests; live credentials/models remain deployment checks.

## Frontend

Command:

```bash
npm run typecheck
npm run lint
npm run test
```

Current verified result: **46 Vitest tests passing**.

Current coverage includes:
- Smart Context insight rules and action chips.
- Context snack-pairing eligibility for SkyFlakes-style cracker products.
- Self-filtering so yogurt, peanut butter, cheese, and whole-fruit products do not recommend themselves.
- Unknown category behavior with no fabricated suggestions.
- Source-ID resolution for snack-pairing evidence records.
- Regression protection that snack pairings do not mutate scanned-product nutrition values or make unsupported glucose-response claims.
- Ingredient context flag categories.
- Curated unlabeled demo Smart Context with no numeric GI or GL.
- Backward-compatible log handling where missing `kind` means packaged-label.
- Estimated-meal log discrimination and partial-status labels.
- Exact-as-fixed plus estimated range aggregation, midpoint display, excluded/unknown counting, and partial-total behavior.
- Unknown label values remaining unknown.
- Type coverage for image-free packaged-label review and local barcode lookup API shapes.
- Workflow progress, citation-link parsing, chunked POST-SSE parsing, and local chat-thread IndexedDB v1→v2 migration/CRUD.

## Backend

Command:

```bash
PYTHONPATH=backend pytest backend/tests
```

If the active `python3` is Python 3.14, use Python 3.13 or earlier for the pinned backend stack because `pydantic-core==2.33.2` may not build on 3.14.

Current coverage includes:
- CSV ingest into the generated OFF SQLite table, including Nescafe barcode `4800361403764` nutrient parsing and SkyFlakes UPC-A alias lookup from `750515018402` to `0750515018402`.
- Local OFF lookup statuses: complete match, partial match, not found, disabled, and missing database.
- Packaged-label analysis/finalize/delete round trip.
- Barcode-only analysis creation and finalize round trip.
- Complete local barcode match skipping VLM.
- Partial local barcode match running VLM while preserving local database fallback values.
- OFF ingredient text classification for sucrose, glucose syrup, maltodextrin, and acesulfame potassium.
- Stateless label-record validation.
- Sugar taxonomy and heuristic demo GL labeling.
- Image quality checks.
- Extraction schema constraints and prohibited claim rejection.
- Curated catalog listing.
- Curated candidate identification and manual fallback.
- Curated record validation.
- Unknown curated food and invalid portion rejection.
- Guarantee that curated demo records return no numeric GI or GL.
- Evidence-type inference for legacy `sourceKind` values and extended evidence/source trail serialization through API responses.
- Strict meal-image schema rejection for macros, invalid ranges, and more than 12 components.
- USDA nutrient-name/number mapping, unit conversion, unknown preservation, and per-100-g endpoint calculations.
- Missing USDA-key behavior and qualitative fallback response.
- Estimated-meal manual analysis SSE, context-only finalization, short-lived cleanup, nested record construction, evidence trails, and partial aggregate labeling.
- Smart Context exact/range triggers, uncertainty-boundary behavior, Philippine pairing examples, cache-hit provenance, invented-number/action/source rejection, and prohibited health/suitability/medication/glucose claims.
- Chat event ordering, product grounding, safety and out-of-scope refusals, request limits, authoritative-domain filtering, curated snack-pairing evidence retrieval, and source deduplication with mocked Ollama output.

Current verified result: **62 backend tests passing**.

## Build Verification

Command:

```bash
npm run build
```

The production Vite build should complete without type or bundling errors.

## End-to-End Browser Tests

Command:

```bash
npm run test:e2e
```

Playwright is configured with one worker so full-page screenshots and route mocks remain deterministic against one preview process. Current verified result: **12 Playwright tests passing**.

Coverage includes:

- No horizontal overflow at 375, 430, 768, 1024, 1440, and 1920 px for the evidence workspace.
- Evidence-chat streaming, source activation, mobile evidence sheet, and focus mode.
- Barcode database product summary, camera-denial recovery, dense label review, validation, and results mode.
- Manual estimated meal through component confirmation, derived breakdown, Smart Context, Today, and History.
- Multi-item photo draft with editable component identity and mobile overflow assertion.
- Packaged-label Context snack-pairing section with controlled SkyFlakes suggestions, expandable evidence, no unsupported claim copy, desktop two-column layout, mobile one-column layout, and update behavior after editing product evidence.

The suite mocks external model/database HTTP responses. It verifies application contracts and fallbacks, not live USDA/Ollama availability or nutritional accuracy.

## Manual Regression Checklist

- Default app route opens `#/sugar-pai/scan`.
- Packaged-label mode shows Smart Context only after validation.
- Eligible packaged snacks show `Pair with this snack` after the main Context explanations; unknown categories do not fabricate suggestions.
- Expanded snack-pairing evidence separates confirmed product evidence from general supporting evidence, and the section never changes scanned-product nutrition values.
- Live barcode scanner detects UPC/EAN codes, shows local lookup status, and opens image-free review for complete local matches.
- Partial or missing barcode matches explain missing fields and keep the image capture path available.
- Meal vision returns only components, preparation clues, portions, ranges, and confidence—never macros.
- Component search/remap, add/remove, household portion, min/max gram editing, and validation errors work with keyboard and touch.
- Missing USDA configuration leaves curated context-only confirmation available.
- Context-only components are excluded from aggregate ranges and partial/unknown warnings remain visible.
- Estimated rows show `~midpoint` and min–max ranges in breakdown, Today, History, JSON, and CSV.
- Estimated records are read-only after saving and can be deleted/recreated.
- Backend food images are deleted at finalize while local image retention remains explicit opt-in.
- Old packaged-label logs without `kind` still open in History.
- Existing `curated_unlabeled_demo` logs still open without migration.
- Exported JSON/CSV excludes retained image blobs.
- Saved logs show their stored Smart Context snapshot rather than regenerating copy.
- No UI copy makes treatment, medication, insulin, suitability, or glucose-prediction claims.
- Ask supports general or validated-product context; sources appear before text; citation activation highlights matching evidence; stop/retry/regenerate preserve the local thread.
- At 375, 430, 768, 1024, 1440, and 1920 px, check for horizontal overflow, fixed-UI overlap, truncated controls, camera denial recovery, and touch targets under 44 px.

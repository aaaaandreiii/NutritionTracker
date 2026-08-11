# Testing Strategy

Sugar pAI V2 uses Vitest for frontend domain logic and pytest for backend API, validation, extraction, taxonomy, glycemic, image-quality, and benchmark behavior.

## Frontend

Command:

```bash
npm run typecheck
npm run test
```

Current coverage includes:
- Smart Context insight rules and action chips.
- Ingredient context flag categories.
- Curated unlabeled demo Smart Context with no numeric GI or GL.
- Backward-compatible log handling where missing `kind` means packaged-label.
- Unknown label values remaining unknown.

## Backend

Command:

```bash
PYTHONPATH=backend pytest backend/tests
```

If the active `python3` is Python 3.14, use Python 3.13 or earlier for the pinned backend stack because `pydantic-core==2.33.2` may not build on 3.14.

Current coverage includes:
- Packaged-label analysis/finalize/delete round trip.
- Stateless label-record validation.
- Sugar taxonomy and heuristic demo GL labeling.
- Image quality checks.
- Extraction schema constraints and prohibited claim rejection.
- Curated catalog listing.
- Curated candidate identification and manual fallback.
- Curated record validation.
- Unknown curated food and invalid portion rejection.
- Guarantee that curated demo records return no numeric GI or GL.

## Build Verification

Command:

```bash
npm run build
```

The production Vite build should complete without type or bundling errors.

## Manual Regression Checklist

- Default app route opens `#/sugar-pai/scan`.
- Packaged-label mode shows Smart Context only after validation.
- Unlabeled demo mode allows manual catalog selection when photo hints fail.
- Curated demo logs show context-only totals in Today and History.
- Old packaged-label logs without `kind` still open in History.
- Exported JSON/CSV excludes retained image blobs.
- No UI copy makes treatment, medication, insulin, suitability, or glucose-prediction claims.

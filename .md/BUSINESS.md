# Business Value and Impact

Sugar pAI V2 is a packaged-food evidence and Smart Context research prototype. It focuses on decision support without cloud accounts, unsupported health claims, or hidden data substitution.

## Problem Statement

1. **Packaged labels are hard to interpret:** Users must reconcile serving size, carbohydrate, sugars, fiber, protein, fat, and ingredient lists.
2. **Ingredient naming is opaque:** Sugar-related ingredients can appear under many names, including HFCS, maltodextrin, syrups, starches, polyols, and high-intensity sweeteners.
3. **Unlabeled foods lack reliable package evidence:** Common Filipino foods often have no nutrition panel, and recipe/portion variation makes authoritative claims risky without licensed data.
4. **Privacy concerns are real:** Food and health-adjacent records are sensitive, and many users prefer local storage.

## Value Proposition

Sugar pAI reduces interpretation friction while preserving evidence boundaries:

- Scan a packaged label.
- Validate what was actually read or user-confirmed.
- Show deterministic Smart Context.
- Log locally.
- Use curated unlabeled demo mode only as qualitative context until permitted datasets exist.

## Core Personas

| Persona | Pain point | V2 response |
| --- | --- | --- |
| Label reviewer | Wants help reading complex package panels. | Evidence-preserving scan, correction, validation, and local log. |
| Ingredient-conscious shopper | Wants to notice sugar aliases and processing markers. | First-class ingredient context flags without food ratings. |
| Filipino-food researcher | Wants a prototype flow for unlabeled foods. | Curated demo catalog with manual confirmation and qualitative tags. |
| Privacy-focused user | Does not want cloud history. | IndexedDB local records and opt-in image retention. |
| Whole-food tracker | Still wants Daily Dozen support. | Dashboard, pantry, groceries, and recipes remain available as secondary tooling. |

## Commercial and Research Potential

- **B2C local-first app:** Packaged-label evidence review and local logging.
- **B2B extraction validation:** Deterministic validation pipeline for nutrition-label extraction workflows.
- **Research prototype:** Evaluates whether Smart Context improves label review without unsupported claims.
- **Future licensed-data path:** Sourced GI or Filipino nutrition values can be added only with permitted datasets and provenance.

## Monetization Boundaries

Potential future premium features should preserve the same evidence-boundary model:
- Optional sync and backup.
- More robust benchmarked extraction.
- Licensed dataset access where legally permitted.
- Professional export/reporting.

No business model should depend on selling identifiable food/health records without explicit, separate, opt-in consent.

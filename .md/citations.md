# Sugar pAI evidence and Smart Context citations

This file maps external evidence to app-owned calculations and deterministic Smart Context rules. Smart Context is educational context only. It does not provide medical advice, individual glucose prediction, medication or insulin guidance, treatment recommendations, or food-suitability claims.

## Evidence sources

| Source ID | Citation | Used for | Not used for |
| --- | --- | --- | --- |
| `sydney-gi-overview` | University of Sydney Glycemic Index Research Service. “About GI.” https://glycemicindex.com/about-gi/ | General GI/GL framing and cautious carbohydrate/meal-context copy. | Does not define Sugar pAI thresholds, originate estimated nutrient grams, or predict an individual response. |
| `food-order-diabetes-care-2015` | Shukla AP, et al. “Food Order Has a Significant Impact on Postprandial Glucose and Insulin Levels.” *Diabetes Care*, 2015. https://diabetesjournals.org/care/article/38/7/e98/30914/Food-Order-Has-a-Significant-Impact-on | Educational food-order context when the complete known carbohydrate or sugar range supports the rule. | Does not prove an effect for every person or meal and does not decide treatment or suitability. |
| `post-meal-exercise-review-2023` | Engeroff T, Groneberg DA, Wilke J. “After Dinner Rest a While, After Supper Walk a Mile?” *Sports Medicine*, 2023. https://pmc.ncbi.nlm.nih.gov/articles/PMC10036272/ | Existing optional movement education for packaged-label demo GL context. | Does not prescribe exercise, set duration/intensity, or predict glucose response. |
| `open-food-facts-local-export` | Open Food Facts product data export, transformed into `backend/app/data/off_ph_products.db` from `research/openfoodfacts_export.csv`. https://world.openfoodfacts.org/data | Exact local barcode product identity and packaged-label draft evidence. | Not user-confirmed label truth, medical advice, a product rating, or a personal glucose prediction. |
| `usda-fdc` | USDA FoodData Central API Guide. https://fdc.nal.usda.gov/api-guide/ and Foundation Foods documentation. https://fdc.nal.usda.gov/Foundation_Foods_Documentation/ | Candidate food identity and per-100-g nutrient values used after the user confirms a match and portion range. | Does not identify what is in a photo, confirm the selected food, represent laboratory analysis of the photographed meal, or supply numeric GI/GL. |

Tavily may add authoritative sources to evidence chat when configured. It is never a source of nutrient grams. Ollama proposes image components or rewrites already grounded Smart Context cards; it is not treated as a nutrient database or source citation.

## Evidence semantics

| Evidence type | Meaning in Sugar pAI |
| --- | --- |
| `observed` | Read from a photographed label or explicitly confirmed by the user. |
| `retrieved` | Returned by a named database source, such as a local Open Food Facts row or USDA FDC record. |
| `estimated` | Proposed from an image or uncertain portion-identification step. The meal-image model may not provide macros. |
| `derived` | Calculated deterministically from evidenced inputs, such as a USDA per-100-g value and confirmed gram endpoints. |
| `contextual` | Qualitative category, ingredient, preparation, or pairing context that does not originate nutrient numbers. |
| `unavailable` | Unknown and kept distinct from zero. |

Legacy `sourceKind`, status, conflict, evidence reference, and confirmation fields remain part of `EvidenceValue`. New records can also carry ranges, confidence bands, timestamped evidence trails, and source metadata.

## Computation mapping

| Computation | Implementation | Source relationship |
| --- | --- | --- |
| Packaged-label consumed-portion nutrients | `smartContextFromAnalysis(...)` scales known per-serving label nutrients by `consumedServings`; unknown values remain unknown. | App-owned deterministic computation from validated label evidence. |
| Packaged-label consumed-portion GL | `portionGlycemicLoad(...)` scales the saved demo GL by `consumedServings` and reclassifies the portion band. | App-owned computation using explicitly labeled `heuristic_demo` output. |
| GL band classification | Green `<= 10`, yellow `> 10 and < 20`, red `>= 20`. | App-owned demo thresholds; the citations above do not define them. |
| USDA portion range | For each known nutrient, `per100g × gramMinimum / 100` through `per100g × gramMaximum / 100`. | Deterministic derived evidence from the confirmed USDA record and user-confirmed `1–5000 g` range. The UI midpoint is summary display only. |
| Estimated-meal aggregate range | Sum component minima and maxima separately across matched components. | A matched-component subtotal. Context-only components are excluded and counted; missing USDA nutrients remain unknown and are counted. |
| Estimated nutrient-rule trigger | A threshold rule fires only when the complete range supports it. A range that crosses a relevant threshold produces `uncertainty-boundary` instead. | App-owned conservative decision rule; the model does not decide triggers. |
| Ingredient flags | Uses saved `sugarVariants` plus ingredient markers for HFCS, maltodextrin, starches, polyols, high-intensity sweeteners, and processing markers. | App-owned text matching. Flags are descriptors only. |
| Curated qualitative fallback | Catalog aliases, tags, portions, and limitations provide context when vision or USDA matching is unavailable. | No authoritative macro, calorie, GI, GL, or FNRI claim is introduced. |
| Grounded Smart Context writing | Backend rules select cards, actions, pairings, and source IDs before optional Ollama rewriting. Output is accepted only if IDs, evidence labels, actions, citations, numbers, and prohibited-claim checks pass. | The writer may change wording only. Invalid, timed-out, or unavailable generation leaves deterministic cards intact. |
| Smart Context cache | Normalized request plus rule, evidence, pairing, writer, writer-enabled, and model versions form the cache key. | Prevents reuse after material evidence or writer configuration changes. Saved logs retain the final response snapshot. |

## Smart Context rule mapping

| Rule ID | Source IDs shown | Rule boundary |
| --- | --- | --- |
| `estimated-boundary` | None | Discloses that ranges come from confirmed portions and USDA matches and cover matched components only. |
| `uncertainty-boundary` | None | Replaces an affected nutrient cue when a range crosses one of its deterministic thresholds. |
| `data-carbs-missing` | `sydney-gi-overview` | Missing carbohydrate stays unknown and disables higher-carbohydrate rules. |
| `fiber-anchor` | `sydney-gi-overview` | Requires the full carbohydrate range to meet the rule and fiber to be low or unknown. |
| `protein-fat-context` | None | App-owned meal-composition context using complete known ranges. |
| `sugar-context` | None | Fires only when the complete total- or added-sugar range supports the threshold. |
| `food-order-higher-carb` | `food-order-diabetes-care-2015` | Educational food-order cue; no guaranteed personal response. |
| `qualitative-context` | None | Preparation and ingredient descriptors remain separate from nutrient grams. |
| `steady-context` | None | Fallback when no additional nutrient rule is supported. |
| `ingredient-sugar-variants` / `ingredient-processing-markers` | None | Existing packaged-label ingredient descriptors. |
| `movement-yellow-red-gl` | `post-meal-exercise-review-2023` | Existing optional education for packaged-label demo GL only. |

The client retains deterministic packaged-label and legacy curated adapters for immediate/offline fallback. The backend `/api/v1/smart-context/resolve` response is authoritative when it passes validation.

## Implementation locations

| File | Purpose |
| --- | --- |
| `backend/app/schemas.py` | Evidence, estimated-meal, FoodData Central, and Smart Context public schemas. |
| `backend/app/meal_image.py` | Strict meal-image schema for components, preparation clues, household portions, gram ranges, and confidence; macros are prohibited. |
| `backend/app/usda.py` | Server-only FoodData Central search/details, nutrient mapping, cache, and portion-range calculation. |
| `backend/app/estimated_meals.py` | Short-lived analysis jobs, candidate matching, confirmation, evidence trails, partial aggregates, and provenance. |
| `backend/app/smart_context.py` | Versioned deterministic rules, Philippine pairing bundles, grounded writer validation, and cache. |
| `backend/app/chat_retrieval.py` | Curated-first evidence-chat retrieval with optional authoritative-domain Tavily sources. |
| `src/domain/pairing.ts` | Client adapters and deterministic fallback for packaged-label and legacy curated records. |
| `src/components/mvp/UnlabeledFoodDemo.tsx` | Photo/manual component review, USDA remapping, portion confirmation, result ranges, immediate fallback cards, and local save. |
| `src/components/mvp/HistoryPage.tsx` | Uses saved Smart Context snapshots, displays estimated component provenance/ranges, and generates a snapshot only when a legacy/edit path lacks one. |
| `src/domain/logs.ts`, `src/lib/db.ts` | Log discrimination/range summaries, legacy normalization, IndexedDB persistence, and JSON/CSV export shaping. |
| `backend/tests/test_estimated_meals.py`, `backend/tests/test_usda.py`, `backend/tests/test_smart_context.py` | Calculation, partial-result, source, boundary, writer, cache, and fallback coverage. |
| `src/domain/pairing.test.ts`, `src/domain/logs.test.ts`, `src/lib/api.test.ts` | Client fallback, range aggregation/export, legacy compatibility, and API parsing coverage. |

# Sugar pAI Pairing Engine Citations

This file maps the evidence used for the Sugar pAI Pairing Engine V1.1 to the implemented computations, UI sections, and user-facing ideas. The feature is deterministic and educational. It does not provide medical advice, individual glucose prediction, or treatment recommendations.

## Evidence Sources

| Source ID | Citation | Used for | Not used for |
| --- | --- | --- | --- |
| `sydney-gi-overview` | University of Sydney Glycemic Index Research Service. "About GI." https://glycemicindex.com/about-gi/ | General GI/GL framing: carbohydrate quality and post-meal glucose response are relevant context for label interpretation. Supports the cautious wording in `data-carbs-missing`, `fiber-anchor`, and "no prediction" language. | Does not set this app's GL band thresholds, fiber threshold, carb threshold, or any personalized response estimate. |
| `food-order-diabetes-care-2015` | Shukla AP, et al. "Food Order Has a Significant Impact on Postprandial Glucose and Insulin Levels." Diabetes Care, 2015. https://diabetesjournals.org/care/article/38/7/e98/30914/Food-Order-Has-a-Significant-Impact-on | Food-order idea: when a label is in a higher-impact context, show an educational suggestion to eat vegetables, beans, or protein foods before the higher-carb item. Used by the `food-order-higher-gl` insight. | Does not prove an effect for every user or every meal; does not decide medication, insulin, or whether a food is safe. |
| `post-meal-exercise-review-2023` | Engeroff T, Groneberg DA, Wilke J. "After Dinner Rest a While, After Supper Walk a Mile? A Systematic Review with Meta-analysis on the Acute Postprandial Glycemic Response to Exercise Before and After Meal Ingestion in Healthy Subjects and Patients with Impaired Glucose Tolerance." Sports Medicine, 2023. https://pmc.ncbi.nlm.nih.gov/articles/PMC10036272/ | Movement education: for yellow/red GL contexts, show optional post-meal movement as an educational experiment when appropriate for the user. Used by the `movement-yellow-red-gl` insight. | Does not prescribe exercise, set exercise duration/intensity, or predict glucose response. |

## Computation Mapping

| Computation | Implementation | Source relationship |
| --- | --- | --- |
| Consumed-portion nutrients | `portionNutrients(...)` multiplies known per-serving label nutrients by `consumedServings`; unknown values remain unknown. | App-owned deterministic computation from validated Sugar pAI label data. No external citation sets this calculation. |
| Consumed-portion GL | `portionGlycemicLoad(...)` multiplies the saved GL value by `consumedServings` and reclassifies the portion band. | App-owned deterministic computation using existing Sugar pAI GL output. The citations support educational context only. |
| GL band classification | Green `<= 10`, yellow `> 10 and < 20`, red `>= 20`. | Mirrors existing Sugar pAI backend GL band constants. The pairing citations do not define these thresholds. |
| Higher-impact context | Triggered when GL band is yellow/red, total sugars are high, added sugars are high, or total carbohydrate is high. | App-owned V1.1 rule. Citations support why GI/GL, food order, and movement can be educational topics, not the exact trigger thresholds. |
| Low-fiber context | `fiber` missing or `< 3 g` in a carb/higher-impact context. | App-owned V1.1 threshold. The University of Sydney source supports carbohydrate-response context, not this exact fiber cutoff. |
| Protein/fat context | Protein missing or `< 7 g`, and fat missing or `< 5 g`, in a carb/higher-impact context. | App-owned V1.1 threshold and pairing heuristic. No cited source sets these cutoffs. |
| Sugar context | Total sugars `>= 10 g` or added sugars `>= 5 g`. | App-owned V1.1 threshold. It drives cautious "sweet part" meal-context copy, not a health claim. |
| Ingredient flags | Uses saved `sugarVariants` plus simple ingredient text markers such as maltodextrin, modified starch, hydrogenated oil, artificial flavor/color, and emulsifier/gum terms. | App-owned text matching. These markers provide context only and do not classify a food as safe/unsafe. |

## UI Section Mapping

| UI section / insight ID | Source IDs shown | Idea origin |
| --- | --- | --- |
| `data-carbs-missing` | `sydney-gi-overview` | GI/GL interpretation requires carbohydrate context; unknown label values should remain unknown. |
| `fiber-anchor` | `sydney-gi-overview` | Fiber additions are framed as meal context around carbohydrate impact, not as a guaranteed glucose intervention. |
| `protein-fat-context` | None | App-compatible pairing heuristic using common protein/fat examples. |
| `sugar-context` | None | App-owned meal-context idea to avoid stacking multiple sweet items. |
| `food-order-higher-gl` | `food-order-diabetes-care-2015` | Educational food-order suggestion based on published food-order evidence. |
| `ingredient-sugar-variants` | None | Uses Sugar pAI's saved sugar taxonomy matches; ingredient rank is presence context only. |
| `ingredient-processing-markers` | None | App-owned ingredient-marker context for simpler pairing choices. |
| `movement-yellow-red-gl` | `post-meal-exercise-review-2023` | Optional post-meal movement education for yellow/red GL records. |
| `steady-label-context` | None | App-owned fallback when no higher-impact pairing rule fires. |

## Implementation Locations

| File | Purpose |
| --- | --- |
| `src/domain/pairing.ts` | Source registry, deterministic insight rules, consumed-portion calculations, and local thresholds. |
| `src/components/mvp/PairingIdeas.tsx` | Shared UI for displaying pairing insights and source links. |
| `src/components/mvp/EvidenceReview.tsx` | Shows pairing ideas after validation on the Review screen. |
| `src/components/mvp/HistoryPage.tsx` | Recomputes pairing ideas from saved `LogEntry` data in the History drawer. |
| `src/domain/pairing.test.ts` | Unit tests for high GL, low fiber, high sugar, sugar variants, incomplete data, and deterministic recomputation. |

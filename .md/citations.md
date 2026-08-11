# Sugar pAI Smart Context Citations

This file maps cited evidence to the deterministic Smart Context rules. Smart Context is educational context only. It does not provide medical advice, individual glucose prediction, medication guidance, insulin guidance, treatment recommendations, or food suitability claims.

## Evidence Sources

| Source ID | Citation | Used for | Not used for |
| --- | --- | --- | --- |
| `sydney-gi-overview` | University of Sydney Glycemic Index Research Service. "About GI." https://glycemicindex.com/about-gi/ | General GI/GL framing: carbohydrate quality and post-meal response are relevant context for label interpretation. Supports cautious wording in packaged-label data-quality and fiber context. | Does not set this app's GL band thresholds, fiber threshold, carb threshold, or any personalized response estimate. |
| `food-order-diabetes-care-2015` | Shukla AP, et al. "Food Order Has a Significant Impact on Postprandial Glucose and Insulin Levels." Diabetes Care, 2015. https://diabetesjournals.org/care/article/38/7/e98/30914/Food-Order-Has-a-Significant-Impact-on | Food-order education for packaged-label records in higher-impact contexts. | Does not prove an effect for every user or every meal; does not decide treatment or suitability. |
| `post-meal-exercise-review-2023` | Engeroff T, Groneberg DA, Wilke J. "After Dinner Rest a While, After Supper Walk a Mile? A Systematic Review with Meta-analysis on the Acute Postprandial Glycemic Response to Exercise Before and After Meal Ingestion in Healthy Subjects and Patients with Impaired Glucose Tolerance." Sports Medicine, 2023. https://pmc.ncbi.nlm.nih.gov/articles/PMC10036272/ | Optional movement education for packaged-label records with yellow/red demo GL context. | Does not prescribe exercise, set exercise duration/intensity, or predict glucose response. |

## Computation Mapping

| Computation | Implementation | Source relationship |
| --- | --- | --- |
| Packaged-label consumed-portion nutrients | `smartContextFromAnalysis(...)` scales known per-serving label nutrients by `consumedServings`; unknown values remain unknown. | App-owned deterministic computation from validated label data. |
| Packaged-label consumed-portion GL | `portionGlycemicLoad(...)` scales saved demo GL by `consumedServings` and reclassifies the portion band. | App-owned computation using already labeled `heuristic_demo` GL output. |
| GL band classification | Green `<= 10`, yellow `> 10 and < 20`, red `>= 20`. | Mirrors backend demo GL constants. Citations do not define these app thresholds. |
| Higher-impact context | Triggered when demo GL band is yellow/red, total sugars are high, added sugars are high, or total carbohydrate is high. | App-owned rule. Citations support why GI/GL, food order, and movement can be educational topics. |
| Ingredient flags | Uses saved `sugarVariants` plus ingredient text markers for HFCS, maltodextrin, starches, polyols, high-intensity sweeteners, and processing markers. | App-owned text matching. Flags are descriptors only. |
| Curated unlabeled demo context | `smartContextFromCuratedRecord(...)` maps qualitative tags and catalog limitations into Smart Context with empty nutrients and unavailable glycemic evidence. | No numeric claims and no cited GI/GL computation. |

## UI Section Mapping

| UI section / insight ID | Source IDs shown | Idea origin |
| --- | --- | --- |
| `data-carbs-missing` | `sydney-gi-overview` | GI/GL interpretation requires carbohydrate context; unknown label values should remain unknown. |
| `fiber-anchor` | `sydney-gi-overview` | Fiber additions are framed as meal context around carbohydrate impact. |
| `protein-fat-context` | None | App-owned context heuristic with common protein/fat examples. |
| `sugar-context` | None | App-owned meal-context idea to avoid stacking multiple sweet items. |
| `food-order-higher-gl` | `food-order-diabetes-care-2015` | Educational food-order suggestion based on published food-order evidence. |
| `ingredient-sugar-variants` | None | Uses Sugar pAI taxonomy matches; ingredient rank is presence context only. |
| `ingredient-processing-markers` | None | App-owned ingredient-marker context. |
| `movement-yellow-red-gl` | `post-meal-exercise-review-2023` | Optional post-meal movement education. |
| `steady-label-context` | None | App-owned fallback when no higher-impact packaged-label rule fires. |
| `curated-demo-boundary` | None | Curated demo limitation disclosure. |
| `curated-meal-context` | None | Qualitative catalog-tag context. |
| `curated-preparation-varies` | None | Recipe/preparation limitation disclosure. |

## Implementation Locations

| File | Purpose |
| --- | --- |
| `src/domain/pairing.ts` | Source registry, Smart Context adapters, deterministic insight rules, action chips, context flags, and local thresholds. |
| `src/components/mvp/PairingIdeas.tsx` | Shared Smart Context UI. |
| `src/components/mvp/EvidenceReview.tsx` | Shows packaged-label ingredient flags and Smart Context after validation. |
| `src/components/mvp/UnlabeledFoodDemo.tsx` | Shows curated demo flow and Smart Context after catalog validation. |
| `src/components/mvp/HistoryPage.tsx` | Recomputes Smart Context for saved packaged-label and curated demo records. |
| `backend/app/unlabeled_foods.py` | Curated Filipino-food demo catalog and validation. |
| `src/domain/pairing.test.ts` | Unit tests for packaged-label and curated demo Smart Context. |

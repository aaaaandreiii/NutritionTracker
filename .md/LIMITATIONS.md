# System Limitations & Technical Debt

To maintain engineering transparency, the following out-of-scope conditions and limitations apply to the current iteration:

## Clinical & Medical Disclaimers
* **Not a Medical Device:** NutritionTracker and the Sugar pAI module do not diagnose, treat, or guide medication/insulin decisions 
* **No Predictive Glucose Modeling:** The Glycemic Index (GI) and Glycemic Load (GL) outputs are educational heuristics based on University of Sydney research. The application does not generate personalized postprandial glucose predictions

## Architectural Bottlenecks & Deferred Features
* **In-Memory Volatility:** Active intake logs, pantry adjustments, and daily UI states exist exclusively in React state. Refreshing the browser will reset these specific elements to static defaults
* **Lack of Multi-Day Tracking:** The system operates on a strict single-day lifecycle without historical calendar syncing or backend database persistence for the Daily Dozen module
* **Hardcoded Routing Constraints:** Dynamically cooked recipes are hardcoded to log exclusively to the *Lunch* slot, and Sugar pAI auto-logs are mapped to the *Afternoon Snack* slot
* **Data Ambiguity Handling:** Unknown label values from the vision model are explicitly kept as "unknown" to prevent false zeros, requiring manual user confirmation before saving
# Archived V1 Feature Inventory

> This file is retained as historical Daily Dozen / early Sugar PAI reference material. It is not the current Sugar pAI V2 application specification. Use `README.md`, `.md/FEATURES.md`, `.md/ARCHITECTURE.md`, `.md/API.md`, `.md/TESTING.md`, `.md/LIMITATIONS.md`, `.md/ROADMAP.md`, and `.md/citations.md` for the current web application state.

# NutritionTracker System Architecture & Comprehensive Feature Inventory Specification

`NutritionTracker` is a client-side, frontend-only React and Vite single-page application (SPA) designed to track Dr. Greger’s Daily Dozen nutrition targets, log daily meal intake, manage household pantry inventory and grocery lists, curate and analyze recipes, and perform simulated computer vision / optical character recognition (OCR) sugar detection via the Sugar PAI scanning module.

---

## 1. Application Architecture, Navigation & Lifecycle

### Route & Navigation System

* **Hash-Based Routing:** Uses browser hash navigation (`window.location.hash`) across four primary client-side routes:
* `#/dashboard` – Daily Dozen progress visualization, category target configuration, and 5-slot meal logging.
* `#/pantry` – Household inventory tracking, automated stock adjustments, grocery shopping lists, and smart restocking.
* `#/recipes` – Culinary database, pantry coverage analysis, meal slot integration, and dynamic local recipe generation.
* `#/sugar-pai` – Camera-first scanning interface for nutrition label scanning, optical character recognition, and sugar hazard detection.


* **Fallback Behavior:** Invalid, unmapped, or empty routes automatically redirect to `#/dashboard`.
* **Sticky Application Header:** Includes persistent header navigation links for all main views (`Sugar PAI`, `Dashboard`, `Pantry & Groceries`, and `Recipes`).
* **Resource Cleanup:** Hook-based media stream cleanup (`navigator.mediaDevices.getUserMedia` video track termination) is automatically invoked when navigating away from `#/sugar-pai` to release hardware camera resources.

### State Architecture & Persistence Matrix

The application operates without a backend database or authentication layer. State management relies on React component state for transient/session data and browser `localStorage` for recipe persistence.

| State Category | Data Scope | Storage Medium | Initial Seed / Reset Behavior |
| --- | --- | --- | --- |
| **Intake Logs** | Logged food entries per meal slot | In-memory React State | Resets on browser reload or via manual Daily Reset |
| **Pantry Stock** | Inventory items, quantities, categories, calories | In-memory React State | Resets to seeded defaults (Oatmeal, Blueberries, Lentils, Spinach) on page reload |
| **Grocery List** | Shopping items, categories, check states | In-memory React State | Resets to seeded default (Walnuts) on page reload |
| **Goal Presets & Overrides** | Selected target preset & category overrides | In-memory React State | Resets to Standard Daily Dozen baseline on reload |
| **Recipes Catalog** | Predefined base recipes + User custom/generated recipes | Browser `localStorage` | Persisted permanently under key `daily_dozen_recipes` |
| **Scanner Results & Camera Feed** | Active frame capture, OCR text, analysis output | In-memory React State | Destroyed on route transition or tab switch |
| **UI, Modals & Notifications** | Modal visibility, draft items, active toasts | In-memory React State | Dismissed automatically or on modal close |

---

## 2. Daily Dozen Dashboard & Target Engine

### The 12 Target Categories

The dashboard tracks daily consumption against the 12 core Daily Dozen items defined by Dr. Greger's evidence-based nutrition guidelines:

1. **Beans & Legumes** (Baseline Target: 3 servings; e.g., black beans, hummus, lentils)
2. **Berries** (Baseline Target: 1 serving; e.g., blueberries, strawberries, blackberries)
3. **Other Fruits** (Baseline Target: 3 servings; e.g., apples, bananas, oranges)
4. **Cruciferous Vegetables** (Baseline Target: 1 serving; e.g., broccoli, kale, Brussels sprouts)
5. **Greens / Salad Greens** (Baseline Target: 2 servings; e.g., spinach, arugula, mixed greens)
6. **Other Vegetables** (Baseline Target: 2 servings; e.g., carrots, bell peppers, tomatoes)
7. **Flaxseeds** (Baseline Target: 1 serving; ground flaxseed)
8. **Nuts & Seeds** (Baseline Target: 1 serving; e.g., walnuts, almonds, chia seeds)
9. **Herbs & Spices** (Baseline Target: 1 serving; e.g., turmeric, cinnamon, oregano)
10. **Whole Grains** (Baseline Target: 3 servings; e.g., oatmeal, brown rice, quinoa)
11. **Beverages** (Baseline Target: 5 servings; e.g., water, green tea, hibiscus tea)
12. **Exercise** (Baseline Target: 1 serving; e.g., 90 min moderate or 40 min vigorous activity)

### Dashboard Display & Metrics

* **Category Progress Cards:** Each category card renders:
* Baseline target vs. currently logged servings.
* Calculated remaining deficit ($\text{Deficit} = \max(0, \text{Target} - \text{Logged Servings})$).
* Dynamic progress bar showing completion percentage.
* Visual status badges indicating incomplete vs. fully fulfilled states.
* Dedicated category icon and distinctive color scheme.


* **Category Detail Overlays:** Interactive modal overlays accessible from each card providing serving size guidelines, concrete examples, and underlying nutritional reasoning.
* **Total Calorie Aggregation:** Live display aggregating cumulative caloric intake across all logged meal slots for the current session.

### Goal Presets & Target Customization

* **Predefined Presets:**
* **Standard Daily Dozen:** Standard baseline targets recommended by evidence-based guidelines.
* **Athletic Fuel:** Scaled targets prioritizing higher carbohydrate, whole grain, and protein intake for active users.
* **Gut Microbiome Booster:** Scaled targets maximizing plant diversity, leafy greens, legumes, and high-fiber foods.


* **Manual Target Overrides:** A configuration panel allowing direct numeric input adjustments per category. Overrides immediately recalculate category deficit metrics across the dashboard.
* **Daily Log Reset:** Global single-click action that clears all five meal slots, resetting logged servings and cumulative calories to zero.

---

## 3. Meal Logging & Food Directory Engine

### Slot Mechanics

Daily intake is partitioned into five distinct chronological meal slots:

* **Breakfast**
* **Morning Snack**
* **Lunch**
* **Afternoon Snack**
* **Dinner**

Each slot interface displays itemized foods, individual and total slot calorie counts, clear slot triggers, and an add/edit modal trigger.

```
[ Meal Slot UI ]
   ├── Logged Items Display (Item Name, Calories, Multiplier)
   ├── Slot Calorie Total
   ├── Clear Slot Trigger (Empties slot intake)
   └── Add/Edit Slot Trigger ──> [ Meal Logging Modal ]

```

### Meal Logging Modal

* **Searchable Food Directory (`foodDB`):** Real-time text search filtering predefined whole foods with built-in caloric values and Daily Dozen serving yields.
* **Meal Slot Tag Filtering:** Visual tags matching foods suitable for specific slots (e.g., suggesting breakfast items for the Breakfast slot).
* **Serving Multiplier Controls:** Granular slider/numeric controls ranging from **0.1x to 10.0x**, dynamically scaling total calories and fractionated serving increments.
* **Draft Entry Staging:** Temporary staging list enabling users to stack multiple items, adjust multipliers, or remove items prior to saving.
* **Editing Active Slots:** Re-opening a previously logged slot populates the modal with existing draft items for modifications.
* **Quick Custom Entry Mode:** Form allowing manual logging of off-directory foods by defining:
* Item Name
* Total Calorie Count
* Custom fractionated serving assignments distributed across any of the 12 Daily Dozen categories.


* **Commit Behavior:** Saving the draft updates the target meal slot in global state, triggering recalculations of category progress and active deficits.

### Smart Meal Suggestions Engine

* **Deficit-Based Scoring:** Algorithmic scoring prioritizing foods that resolve the user's largest active Daily Dozen deficits.
* **Pantry Awareness Weighting:** Highlights and prioritizes foods currently in stock in the Pantry inventory.
* **Quick-Log Stocked Suggestions:** One-click logging for pantry-stocked recommendations. Automatically:
1. Deducts required quantity from Pantry stock.
2. Merges duplicate items in the target meal slot by increasing serving multipliers.


* **Unstocked Suggestions:** Provides an "Add to Grocery List" shortcut for recommended foods not currently stocked in the pantry.

---

## 4. Pantry Inventory & Grocery Hub

### Pantry Management

* **Inventory Data Schema:** Each record includes item name, category, quantity, calories, and Daily Dozen serving metadata.
* **Seeded Initial Stock:** Pre-populated on application start with basic staples: **Oatmeal**, **Blueberries**, **Lentils**, and **Spinach**.
* **Manual Additions:** Supports custom entries specifying item name, category, and initial quantity.
* **Automatic De-duplication:** Adding an item that already exists automatically increments the existing record's quantity count.
* **Quantity Controls:** Incrementation (`+`) and decrementation (`-`) controls floored at a minimum of **0**.
* **Item Deletion:** Direct removal of records from inventory.

### Grocery List Engine

* **Seeded Initial List:** Pre-populated on application start with **Walnuts**.
* **Manual Creation:** Input interface to add grocery items with assigned categories. Duplicate manual additions are automatically blocked.
* **Interactive Checkbox UI:** Allows users to mark items as checked during shopping.
* **Smart Grocery Suggestions:** Recommends items that directly fulfill top open Daily Dozen deficits. Items already present on the grocery list are disabled to prevent duplicates.
* **External Additions:** Allows dashboard food suggestions and recipe missing ingredients to add items directly to the grocery list.

### Sync Workflow ("Buy Checked")

When executing the **Buy Checked** command:

1. Checked items on the grocery list are identified.
2. Items are moved into the Pantry inventory.
3. If an item already exists in the pantry, its quantity is incremented by the purchased amount.
4. Purchased items are purged from the active grocery list.

---

## 5. Recipes & Dynamic Culinary Engine

### Recipe Catalog & Metadata

Driven by a combined dataset of `healthyRecipesDB` and user-created/generated recipes. Each recipe contains:

* Recipe Title & Tagline
* Prep Time & Cook Time
* Total Calories per serving
* Full Itemized Ingredient List
* Step-by-Step Instructions
* Daily Dozen Yield Matrix (exact category servings provided)

### Pantry Coverage & Auto-Stocking

* **Coverage Analyzer:** Cross-references recipe ingredients against active Pantry records.
* **Visual Coverage Indicators:** Displays matching stock status and highlights missing components.
* **Bulk Grocery Transfer:** "Add Missing to Grocery List" button identifies unstocked ingredients and adds them to the grocery list.

### Cook & Log Integration

Executing **Cook & Log to Lunch**:

1. Adds the recipe entry into today's **Lunch** meal slot.
2. Scans Pantry Inventory for matching ingredients and automatically deducts **1 unit** of quantity for each stocked match.
3. Triggers a toast notification confirming the action and listing all deducted pantry items.

### Recipe Builder Tools

* **Manual Recipe Creator:** Modal interface supporting title, tagline, prep time, cook time, calories, comma-separated ingredients, line-separated instructions, and explicit Daily Dozen serving allocations.
* **Dynamic Local Recipe Builder:** Algorithmic feature that evaluates the user's largest active Daily Dozen deficit, dynamically generates a balanced meal recipe targeted at resolving that deficit, and appends it to the catalog.
* **Persistence:** All custom and dynamically generated recipes write to `localStorage` under `daily_dozen_recipes`.

---

## 6. Sugar PAI (Sugar & Label OCR Scanner Simulation)

### Scanning & Hardware Integration

* **Live Camera Interface:** Utilizes `navigator.mediaDevices.getUserMedia` for real-time video feed access.
* **Camera Switching:** Supports toggling between front (selfie) and rear cameras.
* **Hardware Fallback:** Automatically reverts to simulated static images if no camera is available or permissions are denied.
* **Snapshot Processing:** Captures video frames using a hidden HTML5 canvas.
* **Upload Support:** Direct image file dropzone for nutrition label photos.
* **Preset Sample Library:** Includes interactive preset shortcuts simulating various products (e.g., sodas, yogurts, sauces).

```
[ Camera Stream / Upload / Presets ]
                 │
                 ▼
[ HTML5 Canvas Capture / Input Staging ]
                 │
                 ▼
[ OCR Processing State Simulation ]
  ├── Computer Vision Identification
  ├── Optical Character Recognition (Text Extraction)
  ├── Barcode / SKU Matrix Lookups
  └── Glycemic Hazard Analysis
                 │
                 ▼
[ Sugar PAI Detailed Analysis View ]

```

### Sugar PAI Output Metrics

Upon scan completion, the simulated results view provides:

* **Product Identification:** Captured frame preview, detected product name, SKU/barcode readout, and OCR confidence percentage score.
* **Sugar Metrics:**
* Total Sugar (grams) and Teaspoon conversion equivalent ($\text{Teaspoons} = \frac{\text{Grams}}{4}$).
* Natural Sugar vs. Added Sugar breakdown.


* **General Nutrition Metrics:** Calories (`cals`), total carbohydrates, and dietary fiber.
* **Glycemic & Diabetic Profile:**
* Glycemic Index (GI) score, Glycemic Load, and Glycemic Risk Badge indicator.
* Diabetes Sugar Cap Tracker: Visual gauge measuring total sugar against a daily ceiling limit of **25g/day**.


* **Detected Sugar Variants Matrix:** Identifies refined or hidden sugars (e.g., High Fructose Corn Syrup, Cane Sugar, Maltodextrin, Agave Nectar), displaying classification, GI value, and hazard level.
* **Raw OCR Parse:** Parsed raw ingredient string extracted during OCR.
* **Clinical Guidance:** Simulated glucose-response prediction and tailored dietary recommendations.

### Intake Integration

* **Log to Tracker Button:** Transfers the analyzed item into today's **Afternoon Snack** slot, populating the meal log with the item's nutritional parameters.

---

## 7. Static Data Schema Reference

### 1. Daily Dozen Baseline Target Matrix

| Category | Baseline Target | Unit/Examples |
| --- | --- | --- |
| **Beans & Legumes** | 3 servings | $1/2$ cup cooked beans, $1/4$ cup hummus |
| **Berries** | 1 serving | $1/2$ cup fresh/frozen berries |
| **Other Fruits** | 3 servings | 1 medium fruit, $1/4$ cup dried fruit |
| **Cruciferous Veggies** | 1 serving | $1/2$ cup chopped, 1 tbsp horseradish |
| **Greens** | 2 servings | 1 cup raw, $1/2$ cup cooked |
| **Other Vegetables** | 2 servings | $1/2$ cup raw/cooked veggies, $1/2$ cup veggie juice |
| **Flaxseeds** | 1 serving | 1 tbsp ground flaxseed |
| **Nuts & Seeds** | 1 serving | $1/4$ cup nuts/seeds, 2 tbsp nut butter |
| **Herbs & Spices** | 1 serving | $1/4$ tsp turmeric, cinnamon, etc. |
| **Whole Grains** | 3 servings | $1/2$ cup cooked grains/hot cereal, 1 slice bread |
| **Beverages** | 5 servings | 1 glass (12 oz) water, green tea, etc. |
| **Exercise** | 1 serving | 90 min moderate or 40 min vigorous |

### 2. Embedded Database Structures

* **`foodDB`:** Static registry containing whole food records with name, base calorie count, pre-assigned Daily Dozen fractional yield matrix, and valid meal slot tags.
* **`healthyRecipesDB`:** Base recipe catalog specifying preparation details, raw ingredient strings, step-by-step instructions, caloric values, and category serving yields.
* **Sugar PAI Preset Library:** Pre-configured mock analysis records containing full product metadata, image URIs, raw OCR ingredient strings, sugar breakdowns, variant arrays, GI indices, and recommendation strings.

---

## 8. Technical Constraints, Discrepancies & Disclaimers

### Persistence & Data Isolation

* **In-Memory Volatility:** Active intake logs, pantry adjustments, grocery list items, active target presets, custom target overrides, scanner results, and toast notifications exist exclusively in React state. Refreshing or closing the browser resets these items to initial static defaults.
* **Local Persistence Scope:** Only custom and dynamically generated recipes are saved across browser sessions via `localStorage` (`daily_dozen_recipes`).
* **Lack of Multi-Day Tracking:** Operates on a single-day lifecycle. There is no historical calendar, trend reporting, multi-day logging, or backend database sync.

### Hardcoded Integrations & Data Discrepancies

* **Fixed Slot Logging Constraints:**
* **Cook & Log** is hardcoded to log cooked recipes exclusively into the **Lunch** slot.
* **Sugar PAI Auto-Log** is hardcoded to log scanned items exclusively into the **Afternoon Snack** slot.


* **Sugar PAI Calorie Field Mapping Bug:** Sugar PAI analysis payloads define calorie counts under the property name `cals`, whereas the intake logging pipeline looks up calorie counts under `totalCals`. Unmapped Sugar PAI items log zero or undefined calories to the afternoon snack unless transformed during execution.
* **Default Metadata Approximations:** Custom user-created pantry and grocery entries lack granular Daily Dozen selection forms and revert to standard default caloric/serving placeholders.
* **Simulated External Services:** OCR text extraction, barcode SKU lookups, dynamic recipe synthesis, and computer vision image scanning are entirely simulated using static lookup logic and timeout delays rather than external machine learning cloud APIs.

### Medical & Health Disclaimer Scope

* **Simulated Demo Content:** The Sugar PAI feature and diabetes-style risk language rely on hardcoded demo payloads and heuristics. They do not constitute evidence-grounded health guidance or diagnostic outputs.
* **Non-Medical Device:** The application is not a medical device and does not provide clinical diagnosis, medical treatment, insulin/medication adjustments, or individualized glucose predictions.

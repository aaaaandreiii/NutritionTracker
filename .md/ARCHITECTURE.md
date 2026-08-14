# System Architecture

Sugar pAI V2 uses a Vite/React SPA with a FastAPI backend. The product is local-first: FastAPI performs short-lived evidence processing, matching, calculation, and Smart Context resolution; confirmed records and source snapshots live in browser IndexedDB.

## High-Level System Design

```mermaid
graph TD
    subgraph Client [React/Vite SPA]
        Shell[Sugar pAI shell]
        Packaged[Packaged-label scan and review]
        Meal[Estimated meal confirmation]
        Smart[Immediate deterministic and resolved Smart Context]
        Ask[Evidence chat and citations]
        Today[Today range aggregation]
        History[Read-only estimated and editable label history]
        Storage[(IndexedDB and localStorage)]
        Camera[Device Camera API]
    end

    subgraph Backend [FastAPI]
        API[REST and SSE endpoints]
        Sanitizer[Image checks and EXIF stripping]
        LocalOFF[(Generated OFF PH SQLite DB)]
        LabelPipeline[VLM label pipeline]
        MealPipeline[Strict component-only meal pipeline]
        USDAResolver[USDA search details and per-100-g calculation]
        Validator[Deterministic validation]
        Rules[Versioned Smart Context rules and PH pairings]
        Writer[Optional grounded writer and validator]
        Catalog[Curated Filipino-food fallback]
        Chat[Evidence retrieval and guarded chat stream]
        Jobs[(15-minute in-memory jobs)]
    end

    subgraph External [Optional integrations]
        Ollama[Ollama vision and text models]
        USDA[USDA FoodData Central]
        Tavily[Authoritative-domain Tavily search]
    end

    Camera --> Packaged
    Camera --> Meal
    Packaged -->|barcode or package panels| API
    API --> LocalOFF
    API --> Sanitizer
    Sanitizer --> LabelPipeline
    LabelPipeline --> Ollama
    LabelPipeline --> Validator
    LabelPipeline --> Jobs
    Meal -->|photo or manual description| API
    Sanitizer --> MealPipeline
    MealPipeline -->|identity clues and portion range only| Ollama
    MealPipeline --> USDAResolver
    USDAResolver --> USDA
    MealPipeline --> Catalog
    MealPipeline --> Jobs
    Meal -->|confirmed components and gram ranges| USDAResolver
    Packaged --> Smart
    Meal --> Smart
    Smart --> API
    API --> Rules
    Rules -.-> Writer
    Writer -.-> Ollama
    Smart --> Storage
    Today --> Storage
    History --> Storage
    Ask --> API
    Chat -.-> Tavily
    Chat -.-> Ollama
    API --> Chat
    Ask --> Storage
```

## Evidence Resolution and Semantics

The system keeps decision logic deterministic and makes acquisition paths explicit:

1. User-confirmed photographed-label values (`observed`).
2. Exact local Open Food Facts barcode matches (`retrieved`).
3. Exact or user-selected USDA branded/generic matches (`retrieved`).
4. VLM food identity and portion proposals (`estimated`), never nutrient grams.
5. Curated qualitative descriptors (`contextual`) when numeric matching is unavailable.
6. Portion-range arithmetic and aggregates (`derived`).
7. Missing fields (`unavailable`), never implicit zero.

`EvidenceValue` preserves legacy `sourceKind`, status, evidence, confidence, conflict, and confirmation fields. It adds evidence type, optional numeric range, confidence band, timestamped evidence trail, and source metadata. Estimated components carry the same acquisition/correction/calculation history at component level.

## Packaged-Label Data Flow

1. The frontend checks a UPC/EAN through `GET /api/v1/off-products/{barcode}?market=PH`.
2. A complete local OFF record starts `POST /api/v1/analyses/barcode`; partial or missing records retain the package-panel capture path.
3. Image uploads are bounded, decoded, sanitized, re-encoded without EXIF, and placed in a short-lived job directory.
4. The backend uses local database evidence first and calls Ollama only for required photographed fields.
5. Ingredient taxonomy and deterministic nutrient/claim validation run before the result stream completes.
6. The user edits and finalizes with `POST /api/v1/analyses/{id}/finalize`; corrected values become user-confirmed observations.
7. The frontend renders existing deterministic cards immediately and calls `POST /api/v1/smart-context/resolve` asynchronously.
8. Only a validated backend response replaces the fallback. The log stores the selected card/source/provenance snapshot so History is reproducible.

## Estimated Unlabeled-Meal Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as React SPA
    participant A as FastAPI
    participant O as Ollama
    participant D as USDA FDC
    participant I as IndexedDB

    U->>F: Photo or manual food name
    F->>A: POST /unlabeled-meal-analyses
    A->>O: Sanitized photo plus strict no-macro schema
    O-->>A: Components, preparation clues, portions, gram ranges, confidence
    A->>D: Search up to five candidates per component
    A-->>F: SSE stages and EstimatedMealDraft
    U->>F: Confirm/edit identity, match, household portion, and 1–5000 g range
    F->>A: POST /unlabeled-meal-analyses/{id}/finalize
    A->>D: Retrieve selected FDC details
    A->>A: Multiply per-100-g values by confirmed endpoints
    A->>A: Sum known matched-component ranges and count unknown/excluded values
    A-->>F: EstimatedMealRecord
    A->>A: Delete job image directory
    F->>A: POST /smart-context/resolve
    A-->>F: Deterministic or validated generated cards
    F->>I: One nested log plus immutable Smart Context snapshot
```

Key invariants:

- `DetectedMeal` rejects extra fields and more than 12 components. Macros in model output fail schema validation and trigger one correction retry.
- Each component has at most five USDA candidates.
- Only the backend retrieves USDA details; nutrient grams are never accepted from the VLM or arbitrary web text.
- Every confirmed component must have an identity, household portion, and finite ordered `1–5000 g` range. A component without a selected FDC record must be context-only.
- Missing USDA nutrients remain unknown. Known nutrient subtotals retain per-nutrient unknown counts.
- Aggregate ranges cover matched components only and always expose excluded-component count and `partial`.
- Estimated meals do not receive numeric GI/GL or personal glucose predictions.

## Smart Context Orchestration

1. FastAPI normalizes exact values or ranges and their provenance.
2. Versioned deterministic rules decide which cards trigger.
3. Estimated rules require the full range to support the threshold; crossing a boundary produces an uncertainty card.
4. Bundled evidence and constrained Philippine pairings resolve source/action IDs.
5. Optional Ollama writing receives only the allowed facts, cards, actions, and sources.
6. Validation rejects changed/duplicated rule IDs, evidence labels, actions, unknown sources, invented numbers, prohibited claims, and malformed JSON.
7. Timeout, retrieval failure, model failure, or validation failure returns deterministic cards.
8. Results are cached by normalized request and rule/evidence/pairing/writer/model versions. Responses expose `cacheHit` and fallback reason.

The writer cannot originate rule triggers, nutrient values, actions, or citations.

## Local Data Model

IndexedDB database: `sugar-pai-research`

- `logs`: packaged-label, legacy curated, and estimated-meal records.
- `chatThreads`: local chat messages, selected context, and source snapshots (schema version 2).

```mermaid
erDiagram
    LOG_ENTRY {
        string id PK
        string kind
        string analysis_id
        datetime logged_at
        string meal
        string product_name
        object scalar_midpoint_totals
    }
    PACKAGED_LABEL_LOG {
        object analysis_result
        object smart_context_snapshot
        array retained_images_optional
    }
    ESTIMATED_MEAL_LOG {
        object estimated_record
        object range_totals
        object smart_context_snapshot
        array retained_food_image_optional
    }
    ESTIMATED_COMPONENT {
        string component_id
        object gram_range
        object usda_match_nullable
        object nutrient_ranges
        array evidence_trail
        boolean context_only
    }
    CURATED_UNLABELED_LOG {
        object curated_record
    }

    LOG_ENTRY ||--o| PACKAGED_LABEL_LOG : "packaged_label or missing legacy kind"
    LOG_ENTRY ||--o| ESTIMATED_MEAL_LOG : "estimated_unlabeled_meal"
    LOG_ENTRY ||--o| CURATED_UNLABELED_LOG : "curated_unlabeled_demo"
    ESTIMATED_MEAL_LOG ||--|{ ESTIMATED_COMPONENT : contains
```

Exact package values are treated as fixed ranges when Today combines them with estimated ranges. Scalar estimated totals are retained only as compatibility/display midpoints; `rangeTotals` are authoritative. JSON export removes retained blobs. CSV includes midpoint, min, max, excluded count, and partial status.

Missing `kind` continues to mean `packaged_label`. Existing curated records require no migration. Estimated records are read-only in this release.

## Storage and Image Lifecycle

- The backend has no durable user database.
- Package and meal jobs live in process memory for at most 15 minutes.
- Estimated-meal finalize/delete removes its temporary directory immediately.
- Shutdown and expiry cleanup remove all remaining job directories.
- The frontend retains a source photo only after an explicit local opt-in; otherwise no blob enters IndexedDB.
- Telemetry includes latency, source path, cache hit, and fallback reason, but excludes images and raw user notes.

## Service Boundaries

- **Local OFF SQLite:** Static generated community-data evidence for `market=PH`; not user storage and not user-confirmed truth.
- **USDA FoodData Central:** Server-side search/details source for per-100-g nutrient data. API credentials never enter frontend code.
- **Ollama meal vision:** May identify foods and portion uncertainty but is schema-prohibited from producing nutrient grams.
- **Ollama Smart Context writer:** Optional wording layer; cannot select rules or introduce facts.
- **Curated catalog:** Static Philippine-relevant qualitative fallback; never a source of numeric nutrients.
- **Tavily:** Optional authoritative-domain retrieval for evidence chat. It is not a nutrient-gram source.
- **IndexedDB:** Durable local history and chat storage; clearing browser data removes it.

## Safety Boundary

Sugar pAI provides educational evidence context. It does not diagnose, treat, give medication/insulin guidance, decide food suitability, or predict an individual's glucose response. Estimated ranges are portion uncertainty—not laboratory, recipe, or population variance.

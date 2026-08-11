# System Architecture

Sugar pAI V2 uses a Vite/React SPA with a FastAPI backend. The product is local-first: the backend performs short-lived analysis and validation, while confirmed history is stored in browser IndexedDB.

## High-Level System Design

```mermaid
graph TD
    subgraph Client [React/Vite SPA]
        Shell[Sugar pAI shell]
        Packaged[Packaged-label scan]
        Unlabeled[Curated unlabeled demo]
        Smart[Smart Context UI]
        Daily[Daily Dozen support]
        Storage[(IndexedDB and localStorage)]
        Camera[Device Camera API]
    end

    subgraph Backend [FastAPI]
        API[REST and SSE endpoints]
        Sanitizer[Image validation and EXIF stripping]
        Pipeline[VLM label pipeline]
        Validator[Deterministic validation]
        Catalog[Curated Filipino-food demo catalog]
    end

    subgraph External [Optional integrations]
        Ollama[Ollama VLM]
        OFF[Open Food Facts barcode lookup]
    end

    Shell --> Packaged
    Shell --> Unlabeled
    Shell --> Daily
    Camera --> Packaged
    Camera --> Unlabeled
    Packaged -->|multipart package panels| API
    API --> Sanitizer
    Sanitizer --> Pipeline
    Pipeline --> Ollama
    Pipeline -->|optional barcode| OFF
    Pipeline --> Validator
    Validator -->|SSE result| Packaged
    Unlabeled -->|catalog, identify, validate| API
    API --> Catalog
    Catalog --> Validator
    Packaged --> Smart
    Unlabeled --> Smart
    Smart --> Storage
    Daily --> Storage
```

## Packaged-Label Data Flow

1. User captures Nutrition Facts, ingredients, front label, and optional barcode images.
2. Frontend quality checks run locally.
3. Frontend creates an analysis job with `POST /api/v1/analyses`.
4. Backend sanitizes uploads, runs the VLM pipeline, classifies ingredients, checks claims, and streams events.
5. User corrects draft evidence in the review screen.
6. Frontend finalizes with `POST /api/v1/analyses/{id}/finalize`.
7. Backend returns a confirmed `AnalysisResult`.
8. Frontend builds Smart Context and saves the local `packaged_label` log.

## Curated Unlabeled Demo Data Flow

1. User chooses **Unlabeled demo**.
2. Frontend loads `GET /api/v1/unlabeled-foods/catalog?market=PH`.
3. User may upload a food photo; `POST /api/v1/unlabeled-foods/identify` can suggest catalog candidates.
4. User confirms catalog food and portion manually.
5. Frontend validates with `POST /api/v1/unlabeled-food-records/validate`.
6. Backend returns a `CuratedFoodRecord` with qualitative tags, context flags, unavailable glycemic evidence, and limitations.
7. Frontend builds Smart Context and saves the local `curated_unlabeled_demo` log.

## Local Data Model

### IndexedDB

Database: `sugar-pai-research`

Store: `logs`

Log records are union-shaped:

```mermaid
erDiagram
    LOG_ENTRY {
        string id PK
        string kind
        string analysis_id
        datetime logged_at
        string meal
        string product_name
        float total_carbohydrate_nullable
        float total_sugars_nullable
        float added_sugars_nullable
    }
    PACKAGED_LABEL_LOG {
        object result
        array retained_images_optional
    }
    CURATED_UNLABELED_LOG {
        object curated_record
    }

    LOG_ENTRY ||--o| PACKAGED_LABEL_LOG : "kind packaged_label or missing legacy kind"
    LOG_ENTRY ||--o| CURATED_UNLABELED_LOG : "kind curated_unlabeled_demo"
```

Missing `kind` is treated as `packaged_label` for backward compatibility.

### localStorage

Daily Dozen support state and custom recipes remain local to the browser.

## Service Boundaries

- **FastAPI backend:** No durable database. Analysis jobs and uploads expire after 15 minutes.
- **Ollama:** Optional VLM provider for packaged-label extraction.
- **Open Food Facts:** Optional barcode lookup when enabled; community data never replaces current label evidence without review.
- **Curated catalog:** Static qualitative demo data only. It does not contain calories, macros, GI, GL, or FNRI-derived claims.

## Safety Boundary

Smart Context is deterministic educational context. It does not provide medical advice, medication guidance, insulin guidance, suitability claims, or glucose predictions.

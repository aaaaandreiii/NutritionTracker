# System Architecture

NutritionTracker utilizes a decoupled architecture combining a Vite/React Single Page Application (SPA) with a FastAPI backend dedicated to Vision-Language Model processing 

## High-Level System Design

```mermaid
graph TD
    subgraph Client [Frontend - React/Vite SPA]
        UI[User Interface]
        State[React State - Transient]
        Storage[(Browser Storage: IndexedDB & localStorage)]
        Camera[Device Camera API]
    end

    subgraph Backend [FastAPI Server]
        API[REST API Endpoints]
        Sanitizer[Image Sanitization & EXIF Stripper]
        Validator[Deterministic Logic & Validation]
    end

    subgraph External [External Services]
        Ollama[Ollama API: gemma4:12b]
        OFF[Open Food Facts]
    end

    UI -->|Hash-based Routing| State
    UI -->|Persists Data| Storage
    Camera -->|Multipart Form Data| API
    API --> Sanitizer
    Sanitizer --> Ollama
    API -->|Optional Lookup| OFF
    Ollama --> Validator
    Validator -->|Streams Events/JSON| UI

```

## Data Flow & State Boundaries

* Frontend-to-Backend: Label photos, ingredient images, and barcodes are captured via navigator.mediaDevices.getUserMedia or file upload, and sent as multipart form data to the backend
* Local Persistence: The application operates without a centralized cloud database Custom recipes write to localStorage (daily_dozen_recipes), while confirmed Sugar pAI records write to IndexedDB
* Service Boundaries: The FastAPI service handles short-lived, in-memory analysis jobs and purges temporary images upon job completion or route transition
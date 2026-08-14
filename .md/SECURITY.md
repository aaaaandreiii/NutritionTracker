# Security and Privacy Standards

Sugar pAI V2 is engineered with a strict privacy-first, local-first philosophy. Because the application handles potentially sensitive food and health-adjacent records, it minimizes durable backend storage and avoids mandatory cloud persistence.

## Vulnerability Disclosure Policy
We take security seriously. If you discover a security vulnerability in NutritionTracker (e.g., a potential XSS vector in the frontend or an injection flaw in the FastAPI backend), please do **not** open a public issue. 

Instead, privately report the vulnerability to the repository maintainer via direct communication or by utilizing GitHub's private vulnerability reporting feature (if enabled on this repository). Please provide:
- A description of the vulnerability.
- Steps to reproduce.
- Potential impact.

We aim to acknowledge reports within 48 hours and release patches promptly.

## Authentication and Authorization Architecture
**Current State:**
Sugar pAI currently operates **without** user authentication or Role-Based Access Control (RBAC).
- **Frontend:** Acts as a standalone Single Page Application (SPA).
- **Backend:** The FastAPI service exposes endpoints that do not require JWTs or OAuth tokens. The backend is designed to run locally or in a tightly controlled, isolated environment where the user is the sole operator.

**Future State (If Cloud Sync is implemented):**
If a multi-tenant cloud version is developed, it will utilize:
- **OAuth2 / OIDC** for secure authentication (e.g., Google/Apple sign-in).
- **JWT (JSON Web Tokens)** for stateless API authorization.
- Strict **RBAC** to ensure users can only access their own dietary records and history.

## Data Protection Standards

### Data at Rest
- **Frontend:** Daily Dozen support state, custom recipes, and Sugar pAI historical records are stored locally on the user's device using `localStorage` and `IndexedDB`. No personal health data is sent to a central database.
- **Evidence chat:** Thread titles, messages, selected context references, and source snapshots are stored only in browser IndexedDB. The backend receives the active question, at most ten prior turns, and an optional minimal product snapshot; it does not persist them.
- **Backend:** The FastAPI backend does not persist user records. It uses temporary directories (`tempfile.mkdtemp`) for package and meal images. Complete barcode matches can skip upload; estimated-meal finalize/delete removes its directory immediately; unfinished jobs expire after 15 minutes.
- **Local OFF database:** `backend/app/data/off_ph_products.db` is a static generated Open Food Facts product dataset for offline lookup. It is not a user-data store.
- A background worker (`cleanup_expired_jobs`) purges expired package and estimated-meal jobs, and shutdown cleanup removes remaining directories.
- **Estimated records:** Confirmed component identities, USDA source snapshots, ranges, evidence trails, and Smart Context snapshots are saved only in local IndexedDB. A source meal photo is stored locally only through explicit opt-in.
- **Curated fallback:** Catalog entries are static qualitative data. Existing curated records remain browser-local.
- **Optional external processors:** Ollama may receive sanitized label/meal images and constrained evidence prompts. USDA FoodData Central receives component food-search terms and selected FDC-detail requests. Tavily receives an evidence-chat search question only when configured and curated coverage is insufficient; product context is not sent to Tavily. Deployments must disclose processors and hosting arrangements.

### Data in Transit
- When deployed, the frontend and backend must communicate over **HTTPS/TLS 1.2+** to ensure that multipart form data (including images of food labels) cannot be intercepted in transit.

### Data Sanitization
- **EXIF Stripping:** To protect user privacy, the backend aggressively sanitizes all uploaded images. Location data, device metadata, and other EXIF tags are stripped before the image is analyzed by the VLM.
- **Input Validation:** Strict Pydantic schemas bound image size, strings, list sizes, component counts, candidate counts, confidence, and numeric ranges. Confirmed portions require finite ordered `1–5000 g` endpoints. The meal-image schema forbids extra macro/claim fields.
- **Server-Originated Nutrients:** Finalize accepts selected USDA FDC IDs and portion ranges, not client/model nutrient grams. FastAPI retrieves source details and performs deterministic calculations.
- **Generated-Copy Validation:** Smart Context writing cannot change rules, evidence labels, actions, sources, or introduce numbers. Prohibited medical, suitability, medication/insulin, and glucose-prediction language falls back to deterministic copy.

### Secrets

- Keep `USDA_FDC_API_KEY` and `TAVILY_API_KEY` server-side and outside version control.
- Never prefix backend secrets with `VITE_`; Vite variables are bundled for browsers.
- Avoid pasting full Compose/process environment dumps into tickets or logs because resolved configuration can contain credentials.
- Telemetry may record latency, source path, cache hit, component count, and fallback reason. It must not record images, raw user notes, credentials, or unrestricted prompts containing private input.

## Public Deployment Requirements

Before exposing the backend beyond a local or controlled research environment:
- Add rate limiting for image upload endpoints.
- Restrict CORS origins.
- Serve over HTTPS.
- Decide whether authentication is required.
- Document VLM and local barcode lookup processors in user-facing disclosure.
- Apply rate limits to `/api/v1/chat/stream`, keep the Tavily key server-side, and review the authoritative-domain allowlist periodically.
- Apply independent upload/search/finalize limits to `/api/v1/unlabeled-meal-analyses`, `/api/v1/food-data/search`, and `/api/v1/smart-context/resolve`; keep USDA credentials server-side.
- Replace the in-process job and cache dictionaries before multi-worker or multi-tenant deployment.

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
- **Backend:** The FastAPI backend does not persist user data. It utilizes temporary directories (`tempfile.mkdtemp`) to hold uploaded images just long enough for the VLM to process them. 
- A background worker (`cleanup_expired_jobs`) guarantees that temporary files are purged when a job expires, and `shutil.rmtree` is used aggressively upon pipeline completion or error.
- **Curated unlabeled demo:** Catalog entries are static qualitative data. User-selected demo records are saved only in local IndexedDB unless a future sync feature is explicitly added.

### Data in Transit
- When deployed, the frontend and backend must communicate over **HTTPS/TLS 1.2+** to ensure that multipart form data (including images of food labels) cannot be intercepted in transit.

### Data Sanitization
- **EXIF Stripping:** To protect user privacy, the backend aggressively sanitizes all uploaded images. Location data, device metadata, and other EXIF tags are stripped before the image is analyzed by the VLM.
- **Input Validation:** The backend uses strict Pydantic schemas to validate all incoming data. The deterministic validation layer ensures that numerical values such as carbohydrate and sugar grams cannot be manipulated into malicious payloads such as NaN injections or buffer overflows.

## Public Deployment Requirements

Before exposing the backend beyond a local or controlled research environment:
- Add rate limiting for image upload endpoints.
- Restrict CORS origins.
- Serve over HTTPS.
- Decide whether authentication is required.
- Document VLM and optional barcode lookup processors in user-facing disclosure.

# Security & Privacy Standards

NutritionTracker is engineered with a strict "Privacy-First, Local-First" philosophy. Because the application handles potentially sensitive dietary and health tracking information, we have minimized the attack surface by decentralizing data storage and omitting mandatory cloud persistence.

## Vulnerability Disclosure Policy
We take security seriously. If you discover a security vulnerability in NutritionTracker (e.g., a potential XSS vector in the frontend or an injection flaw in the FastAPI backend), please do **not** open a public issue. 

Instead, privately report the vulnerability to the repository maintainer via direct communication or by utilizing GitHub's private vulnerability reporting feature (if enabled on this repository). Please provide:
- A description of the vulnerability.
- Steps to reproduce.
- Potential impact.

We aim to acknowledge reports within 48 hours and release patches promptly.

## Authentication and Authorization Architecture
**Current State:**
NutritionTracker currently operates **without** user authentication or Role-Based Access Control (RBAC). 
- **Frontend:** Acts as a standalone Single Page Application (SPA).
- **Backend:** The FastAPI service exposes endpoints that do not require JWTs or OAuth tokens. The backend is designed to run locally or in a tightly controlled, isolated environment where the user is the sole operator.

**Future State (If Cloud Sync is implemented):**
If a multi-tenant cloud version is developed, it will utilize:
- **OAuth2 / OIDC** for secure authentication (e.g., Google/Apple sign-in).
- **JWT (JSON Web Tokens)** for stateless API authorization.
- Strict **RBAC** to ensure users can only access their own dietary records and history.

## Data Protection Standards

### Data at Rest
- **Frontend:** All Daily Dozen progress, custom recipes, and Sugar pAI historical records are stored locally on the user's device utilizing `localStorage` and `IndexedDB`. No personal health data is sent to a central database.
- **Backend:** The FastAPI backend does not persist user data. It utilizes temporary directories (`tempfile.mkdtemp`) to hold uploaded images just long enough for the VLM to process them. 
- A background worker (`cleanup_expired_jobs`) guarantees that temporary files are purged when a job expires, and `shutil.rmtree` is used aggressively upon pipeline completion or error.

### Data in Transit
- When deployed, the frontend and backend must communicate over **HTTPS/TLS 1.2+** to ensure that multipart form data (including images of food labels) cannot be intercepted in transit.

### Data Sanitization
- **EXIF Stripping:** To protect user privacy, the backend aggressively sanitizes all uploaded images. Location data, device metadata, and other EXIF tags are stripped before the image is analyzed by the VLM.
- **Input Validation:** The backend uses strict Pydantic schemas to validate all incoming data. The deterministic validation layer ensures that numerical values (like calories and carbs) cannot be manipulated into malicious payloads (e.g., NaN injections or buffer overflows).
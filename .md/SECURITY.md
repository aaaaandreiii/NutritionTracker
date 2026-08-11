# Security Policy

## Vulnerability Disclosure Policy
We take the security of NutritionTracker and its users' data seriously. If you discover a security vulnerability within the application, the API, or the local VLM pipeline, please privately report it by emailing [Your Contact Email]. Do not disclose vulnerability details publicly until a patch has been released. We aim to acknowledge reports within 48 hours and provide timelines for a resolution.

## Authentication and Authorization Architecture
Currently, NutritionTracker operates as a local-first, single-page application without a centralized cloud authentication layer. 
* **User Identity:** There are no user accounts, JWTs, or OAuth2 flows implemented in the current iteration.
* **Authorization (RBAC):** All users accessing the local instance have full administrative control over their local data, presets, and history. 

## Data Protection Standards
* **Data at Rest:** Daily Dozen state is kept in memory, while recipes (`localStorage`) and confirmed Sugar pAI records (`IndexedDB`) are stored locally on the client's device. Original scanned images are only stored locally if the user explicitly opts in.
* **Data in Transit:** When querying external services (e.g., Open Food Facts via the `SUGAR_PAI_ENABLE_OFF_LOOKUP` flag), standard HTTPS/TLS encryption is utilized.
* **Sanitization:** The backend sanitizes uploaded images, strips EXIF metadata, and enforces file size limits before transmitting panels to the local `gemma4:12b` VLM.
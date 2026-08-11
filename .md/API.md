# Internal API Documentation

The Sugar pAI research backend runs via FastAPI (default port 8000).

### `POST /api/v1/analyses`
Initiates a new label analysis job.
* **Content-Type:** `multipart/form-data`[cite: 1]
* **Payload:**
  * `nutrition_image` (File, required): The core nutrition facts panel.
  * `ingredient_image` (File, optional): The ingredient list panel.
  * `front_image` (File, optional): The product's front packaging.
  * `barcode` (String, optional): Extracted UPC/EAN code.
  * `market` (String, required): Expected values `PH` or `US`.
* **Response:** Returns a temporary Job ID.

### `GET /api/v1/analyses/{id}/events`
Subscribes to Server-Sent Events (SSE) for a specific job ID.
* **Response:** Streams processing stages (image checks, barcode lookup, VLM extraction, validation) and the final result payload

### `POST /api/v1/analyses/{id}/finalize`
Commits user corrections after manual review
* **Content-Type:** `application/json`
* **Payload:** The manually verified and corrected nutrition matrix.
* **Response:** Deterministic validation output ensuring nutrient arithmetic is sound.

### `DELETE /api/v1/analyses/{id}`
Deletes temporary job state and purges local images from memory/disk
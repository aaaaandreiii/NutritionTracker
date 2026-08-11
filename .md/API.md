# API Documentation

The FastAPI backend provides RESTful endpoints to manage the asynchronous Sugar pAI extraction pipeline.

## Endpoints

### 1. Health Check
`GET /health`
- **Description:** Verifies the backend is alive.
- **Response:** `200 OK`
  ```json
  { "status": "ok" }
  ```

### 2. Create Analysis Job
`POST /api/v1/analyses`
- **Description:** Initializes a new analysis job. Uploads are sanitized and saved to a temporary directory.
- **Content-Type:** `multipart/form-data`
- **Payload:**
  - `nutrition_image` (File, required): Image of the Nutrition Facts panel. Max 8MB.
  - `market` (Form, required): String, enum `["PH", "US"]`.
  - `ingredient_image` (File, optional): Image of the ingredient list.
  - `front_image` (File, optional): Image of the product front.
  - `barcode` (Form, optional): String, max 32 chars, numeric only.
- **Response:** `202 Accepted`
  ```json
  { "analysis_id": "uuid-string" }
  ```
- **Errors:**
  - `413 Payload Too Large`: Image exceeds 8MB.
  - `422 Unprocessable Entity`: Invalid image format or validation error.

### 3. Stream Analysis Events (SSE)
`GET /api/v1/analyses/{analysis_id}/events`
- **Description:** Streams Server-Sent Events (SSE) as the pipeline progresses.
- **Headers:** `Cache-Control: no-cache`
- **Payload Format:** JSON objects prefixed with `data: `.
  ```json
  data: {"type": "status", "message": "Extracting macros..."}
  ```
- **Errors:**
  - `404 Not Found`: Analysis ID invalid or expired.

### 4. Finalize Analysis
`POST /api/v1/analyses/{analysis_id}/finalize`
- **Description:** Submits the user-reviewed data for strict deterministic validation.
- **Content-Type:** `application/json`
- **Payload:** `FinalizeRequest` schema containing the reviewed `nutrients` (calories, carbs, sugars, etc.), `product_name`, `serving_size`, and `raw_ingredients`.
- **Response:** `200 OK`
  Returns the strictly validated `AnalysisResult` JSON record ready for IndexedDB storage.
- **Errors:**
  - `409 Conflict`: Analysis is still processing.
  - `422 Unprocessable Entity`: Failed deterministic validation (e.g., Total Sugars > Total Carbohydrates).

### 5. Validate Label Record (Stateless)
`POST /api/v1/label-records/validate`
- **Description:** Stateless endpoint to run validation logic without an existing analysis job.
- **Content-Type:** `application/json`
- **Payload:** `FinalizeRequest` schema.
- **Response:** `200 OK` Returns `LabelRecordValidationResponse`.

### 6. Delete Analysis Job
`DELETE /api/v1/analyses/{analysis_id}`
- **Description:** Prematurely cancels a job and aggressively purges its temporary directory.
- **Response:** `204 No Content`
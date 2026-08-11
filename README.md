# NutritionTracker (Daily Dozen + Sugar pAI)

NutritionTracker is a comprehensive, privacy-first web application designed to help individuals track their whole food plant-based diet (inspired by the Daily Dozen) while simultaneously offering advanced, AI-driven nutritional label analysis to uncover hidden sugars and calculate glycemic impacts.

## Overview
Tracking nutrition shouldn't compromise your privacy or require manual data entry for every complex nutritional label. NutritionTracker solves this by combining an intuitive Daily Dozen checklist with a cutting-edge Vision-Language Model (VLM) backend. Users can log their daily whole food intake locally, scan food labels using their device camera, and have an AI instantly extract and validate the nutritional facts—all without cloud accounts or mandatory data sharing.

## Hero Features
- **Daily Dozen Tracking Engine:** Seamlessly track servings, calories, and nutritional deficits across custom goals and meal slots, entirely within your browser.
- **Sugar pAI Vision Extraction:** Snap a photo of a nutrition label and ingredient list; our local VLM (powered by Ollama and Gemma4:12b) automatically extracts macros, identifies hidden sugar aliases, and estimates glycemic impact.
- **Privacy-First Local Storage:** No cloud accounts required. Daily tracking state is kept in memory and `localStorage`, while AI-scanned labels are securely persisted in your browser's `IndexedDB`.
- **Deterministic Validation:** The backend AI extraction is paired with strict, deterministic Python validation to catch arithmetic errors and ensure nutritional accuracy before you save a log.

## Setup Steps

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Ollama](https://ollama.ai/) installed locally (if running the VLM pipeline on your own hardware)

### Local Environment Setup
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd NutritionTracker
   ```
2. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   # Edit .env to set your LLM_PROVIDER and OLLAMA_BASE_URL if necessary
   ```
3. **Pull the AI Model (Optional but recommended):**
   ```bash
   ollama pull gemma4:12b
   ```

## Quickstart Guide

The easiest way to run the entire stack (Frontend Vite app and Backend FastAPI service) is via Docker Compose.

```bash
docker-compose up --build
```

- **Frontend:** Access the Daily Dozen and Sugar pAI UI at [http://localhost:5173](http://localhost:5173).
- **Backend API:** The FastAPI swagger documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

### How to use
1. **Navigate to the Dashboard (`#/dashboard`)** to set your target presets (e.g., Standard Daily Dozen) and begin logging meals.
2. **Scan a Label (`#/sugar-pai/scan`)** using your webcam or file upload to experience the AI-powered label extraction.
3. **Review your History (`#/sugar-pai/history`)** to see your previously saved and validated nutritional records.

# Business Overview: NutritionTracker

## Problem Statement & Business Impact
Tracking granular dietary goals alongside hidden sugars requires tedious manual logging and medical literacy that most consumers lack. In the Philippines, the prevalence of packaged foods with obfuscated sugar variants makes evidence-based nutrition difficult. NutritionTracker bridges this gap by combining Dr. Greger's Daily Dozen guidelines with local, privacy-first AI vision models that instantly decode nutrition labels. 

For micro, small, and medium enterprises (MSMEs) operating in the health and wellness sector, this system provides a highly customizable, embeddable white-label application for client dietary tracking without the overhead of enterprise software.

## Core User Personas & Feature Matrix

| Persona | Primary Goal | Key Features |
| :--- | :--- | :--- |
| **Health-Conscious Individual** | Hit daily whole-food targets | Dashboard visualization, smart meal suggestions, dynamic recipe builder[cite: 1]. |
| **Pre-diabetic / Sugar Monitor** | Identify hidden sugar variants | Sugar pAI scanning, OCR extraction, Glycemic Load band classification[cite: 1]. |
| **Household Shopper** | Minimize food waste, streamline buying | Pantry inventory syncing, automated grocery list generation based on deficits[cite: 1]. |

## Monetization Model & Operational Cost Efficiency
NutritionTracker is architected for extreme cost efficiency. By routing the VLM extraction path through a local `gemma4:12b` model via an Ollama-compatible API[cite: 1], the application achieves zero variable cloud AI costs per scan. Future monetization phases for MSME deployments can include flat-rate licensing for the custom application or tiered support models for setting up the local ML infrastructure.
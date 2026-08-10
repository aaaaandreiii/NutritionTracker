# **Sugar PAI: Project Master Document & Technical Write-Up**

**Course:** STAI100 - Introduction to Agentic AI, Final Capstone

**Team:** Avelino, Sophia; Balingit, Andrei; Filipino, Audric

**Core Mission:** A proactive, AI-agentic nutritional detective that reads physical nutrition labels and ingredients to estimate Glycemic Load (GL) and flag hidden sugars for diabetics in the Philippines.

---

## **1. Executive Summary & Problem Statement**

**The Problem:**
Diabetes and prediabetes management in the Philippines relies heavily on accurate nutrition label reading. However, most labels do not display a Glycemic Index (GI), and existing apps (MyFitnessPal, Carb Manager, GoCoCo) treat sugar as a single undifferentiated number or simply flag "hidden sugars" without contextualizing their impact on blood glucose. Furthermore, localized foods (e.g., packaged *kakanin*) are underrepresented in international databases and often utilize alternative sweeteners like "coco sugar" or "muscovado" that leave consumers guessing.

**The Solution (Sugar pAI):**
Sugar pAI shifts the paradigm from *reactive logging* to *proactive decision-making*. A user photographs a nutrition label or ingredients list in the grocery aisle. The agent extracts the total sugar, identifies the specific types of sugar present, estimates the GI, and provides a clear low/medium/high safety flag. It acts as an on-the-spot nutritional detective, saving users time and anxiety before they purchase or consume a product.

---

## **2. The Science: Glycemic Index (GI) vs. Glycemic Load (GL)**

To ensure the application remains scientifically grounded while avoiding giving direct medical advice, the system will estimate **Glycemic Load (GL)** rather than just GI.

* **The Limitation:** GI cannot be purely mathematically computed from a label; it is a clinical measurement of physiological response.
* **The Workaround:** The agent maps the extracted ingredients to a known database to find a baseline GI, and then computes the GL to account for portion size.
* **The Formula:**

$$GL = \frac{\text{Estimated GI} \times \text{Grams of Net Carbohydrates}}{100}$$


* **Disclaimer:** The UI will strictly feature guardrails explicitly stating that estimates are derived from population averages (ignoring individual matrix effects like fiber or fat absorption) and do not constitute medical advice.

---

## **3. System Architecture & Methodology**

To meet rigorous software engineering standards, the MVP focuses tightly on the label-reading pipeline.

### **3.1 The Hybrid Computer Vision Approach**

Relying solely on one extraction method presents drawbacks in cost, latency, or accuracy. Sugar pAI will utilize a tiered approach:

| Feature | Standard OCR (Fallback/Numeric) | Vision-Language Models (Primary) |
| --- | --- | --- |
| **Data Types** | Highly accurate for structured tables. | Excellent at reading dense ingredient paragraphs and inferring context. |
| **Performance on Noise** | Struggles with crumpled, curved, or low-light labels. | 3-4x lower character error rate on noisy/distorted text (OCR benchmarks). |
| **Speed & Cost** | Milliseconds latency; virtually free. | Higher latency (seconds); API costs per scan. |
| **Role in Sugar pAI** | Fallback for extracting quantitative macros if VLM fails. | Primary engine for classifying sugar aliases and outputting structured JSON. |

*Note: Barcode scanning (via Open Food Facts) will be implemented as a "Step 0" instant-lookup before invoking CV/VLM costs.*

### **3.2 Component Distribution (Draft)**

* **CV/DS Domain Integration (Filipino):** VLM-based extraction, evaluated against traditional OCR for messy real-world label photos.
* **RAG & Retrieval (Balingit):** Matching recognized ingredients to the FNRI PhilFCT and fallback GI databases. Deployment of the REST API endpoint (e.g., FastAPI).
* **Guardrails & UI (Avelino):** Streamlit/Gradio front-end. Implementing system prompts that block medical-advice framing and ensure disclaimers are visible.
* **LLMOps:** Integration of MLflow (or equivalent) to track latency, token usage, and extraction errors. Containerization via Docker.

---

## **4. Data Sources & Integration**

To prevent database bloat, the backend will utilize Retrieval-Augmented Generation (RAG) against established datasets:

1. **FNRI Philippine Food Composition Tables (PhilFCT):** The primary source for local foods, specific local sugars, and *kakanin*.
2. **Trinidad et al. (2010):** Measured GI values for 40 commonly consumed Filipino carbohydrate foods (serves as our local ground truth).
3. **University of Sydney GI Database / USDA FoodData Central:** Fallback databases for international and generic foods.
4. **Open Food Facts:** For SKU/Barcode cross-referencing.

---

## **5. UI/UX Flow (The MVP)**

The UI is laser-focused on a single user trajectory to prevent scope creep:

* **Screen 1: The Scanner.** A camera viewfinder with toggles for "Scan Barcode" or "Scan Label." Overlay brackets guide the user to snap both the Nutrition Facts and Ingredients.
* **Screen 2: Processing.** Microcopy indicating the agentic steps (*"Spotting hidden sugars..." -> "Estimating Glycemic Load..."*).
* **Screen 3: The Verdict.**
* **Traffic Light Scorecard:** Displays the GL estimate color-coded (Green: $\le 10$, Yellow: $11-19$, Red: $\ge 20$).
* **Sugar Breakdown:** Total Sugar (extracted from table) + Identified Hidden Sugars (extracted via VLM).
* **Actionable Context:** A brief, VLM-generated non-medical tip (e.g., *"High sugar, zero fiber. Pairing with a protein may slow glucose absorption."*).



---

## **6. Experiments, Evaluation & Next Steps**

We will evaluate the agent pipeline across three dimensions:

1. **Unit-Level Accuracy (MAE):** Measuring the Mean Absolute Error between the sugar grams extracted by the CV/VLM component and the true label value, specifically tested against a held-out set of poorly lit or crumpled labels.
2. **GI Estimation Accuracy:** Comparing the agent's weighted GI estimate against the Trinidad et al. (2010) ground-truth values to measure drift.
3. **Trajectory / End-to-End Eval:** Verifying if the full pipeline successfully outputs the correct Low/Medium/High classification.
4. **LLM-as-a-Judge:** Evaluating the final plain-language output to ensure zero instances of unauthorized medical advice or overstated certainty.

**Future Roadmap (Post-Capstone):**

* Implementing a pure food-recognition pathway for unlabeled street foods/*kakanin*.
* Expanding the hardcoded dictionary of sugar aliases (~60 FDA-recognized variants).
* Adding a gluten-flag stretch feature using the same ingredient-parsing step.

---

This consolidated version tightens up your narrative, making it ready to drop into a presentation deck or a final repo README.

Since you'll be building out the REST API and the RAG pipeline for the FNRI database, have you decided which specific framework (like FastAPI or Flask) you plan to use to handle the VLM endpoints and database queries efficiently?
SUGAR PAI

Health app for diabetics - sugar tracker/GI estimator

Focus on nutrition labels + ingredients list for VLMs/OCR;

VLMs recommended - but do research and present tradeoffs

Health tracking app - recommend diets, health issues; based on receipts or grocery list - can easily bloat scope

MINIMUM
- Read the sugar (grams) from nutrition label -> relate to GI (ingredients list + grams of sugar)
- (2nd) ingredients list (variants of sugar - fructose, etc.)


Focus on sugars - for diabetes use case (fructose, sucrose etc.)

CV:
- nutrition labels (e.g. total sugars added)
- OCR for SKU is also ok

SUGAR DETAILS:
- type of sugar
- amount or vol of sugar (estimated)
- glycemic index value

Data sources:
- nutritiondata.org (or similar)

Proof Point (Question to answer): Can an agent reliably measure/estimate the sugar content (and compute GI) given picture(s) of food/nutrition labels

To Integrate: Computer Vision 

Research on:

1. Do any of calorie tracker apps have something for diabetics. If there are, focus on differentiating feature

2. Research on diabetes - health concerns. Understand Glycemic Index (GI). Can this be computed directly from grams of sugar + type of sugar. Can give GI (this is not advice).

3. Data Sources
a) look for reliable data sources (pub med, nutrition data)
b) look for data sources for SKU for OCR

4. Come up with UI/UX draft - for Th

to investigate: https://glycemicindex.com/gi-search/


what im thinking of is, 
1 CV to read nutrition label
2 display info 
   - ingredients list, 
   - sugar: type of sugar, amount/vol of sugar (estimated), GI


Here is a detailed breakdown to help you flesh out **Sugar pAI**. This concept has strong potential because it shifts the focus from *reactive* logging (which many apps do) to *proactive* decision-making in the grocery aisle.

---

## 1. Competitive Landscape & Your Differentiator

**The Research:** Most apps targeting diabetics fall into two categories:

1. **Calorie & Macro Trackers (MyFitnessPal, LoseIt, Carb Manager):** These are built for weight loss or keto diets. They track macros efficiently but don't interpret the *quality* of ingredients or flag hidden sugars well.
2. **Diabetes Logbooks (mySugr, Glucose Buddy):** These are heavily focused on logging blood glucose readings, HbA1c, and calculating insulin doses.

**The Gap (Your Differentiator):** A proactive, pre-consumption investigation tool. Instead of just logging what a user ate, Sugar pAI helps them translate confusing nutrition jargon and spot hidden sugar aliases *before* they buy or eat a product. It serves as a pocket nutritional detective rather than a medical logbook.

## 2. The Science: GI vs. GL

*Can an agent reliably compute GI from grams of sugar and type of sugar?*

**Direct Answer:** No, the Glycemic Index (GI) cannot be calculated purely mathematically from a nutrition label. GI is a physiological measure determined by testing how humans react to a food in a clinical setting. It is influenced by the type of sugar, but also heavily altered by the presence of fiber, fat, protein, and how the food was processed.

**The Solution: Glycemic Load (GL)**
While you can't compute the GI directly, you can map the ingredients to a known database to estimate the GI, and then compute the **Glycemic Load (GL)**. GL is vastly more useful for diabetics because it accounts for portion size.

* **The Formula:** `GL = (Estimated GI x Grams of Net Carbohydrates) / 100`
* **The Workflow:**
1. Scan Nutrition Facts -> Extract Total Carbs and Dietary Fiber to get "Net Carbs".
2. Scan Ingredients -> Identify the primary sweeteners (e.g., sucrose vs. maltodextrin).
3. Cross-reference food type to estimate a base GI.
4. Compute and display the estimated GL.



*(Disclaimer: The app must explicitly state that estimates are not medical advice, as individual glucose responses vary).*

## 3. Technology Trade-offs: VLM vs. OCR

To achieve the MVP (reading labels + ingredients), you have two primary computer vision routes. Relying solely on one has drawbacks.

| Feature | Standard OCR (Google Cloud Vision, Tesseract) | VLMs (GPT-4o, Gemini 1.5 Pro, Claude 3.5) |
| --- | --- | --- |
| **Accuracy on Numbers** | Extremely high for structured data (Nutrition tables). | Can occasionally hallucinate numbers or misalign rows in complex tables. |
| **Ingredient Analysis** | Extracts raw text; requires a secondary database check to flag hidden sugars. | Excellent at reading dense paragraphs, inferring context, and classifying sugar types instantly. |
| **Speed & Cost** | Fast and practically free at scale. | Slower latency and higher API cost per scan. |
| **SKU/Barcode Support** | Standard barcode scanners are instant and 100% accurate. | Overkill; VLMs aren't needed for barcode lookups. |

**Recommended MVP Architecture: The Hybrid Approach**

1. Use standard **Barcode Scanning** first. If the product exists in a database, pull the data instantly.
2. If no barcode is found, use **Standard OCR** to grab the exact quantitative numbers from the Nutrition Facts (Total Sugars, Carbs, Fiber).
3. Pass the dense, hard-to-read Ingredients block to a **VLM** with a prompt like: *"Identify all aliases for sugar in this text and rank them by their typical Glycemic Index impact."*

## 4. Data Sources

To make the backend reliable without bloating your own infrastructure, rely on these existing databases:

* **For SKU/Barcode Lookups:** **Open Food Facts** is an open-source, free, and massive global product database containing ingredients and nutrition values.
* **For GI/GL Estimates:**
* **University of Sydney GI Database:** The global gold standard for GI research. You can map common food categories to their verified index.
* **API League / Spoonacular (Compute Nutrition API):** They offer an API endpoint that takes a list of ingredients and returns an estimated Glycemic Index and Glycemic Load.


* **For Sugar Aliases:** Create a static, hardcoded dictionary of the ~60 names for sugar (dextrose, agave nectar, barley malt, maltodextrin, high-fructose corn syrup, etc.) based on FDA or USDA documentation.

## 5. UI/UX Draft (The "Sugar pAI" Flow)

To avoid the scope bloat you mentioned, keep the UI laser-focused on the single use case: *Scanning a product to decide if it's safe to eat.*

**Screen 1: The Scanner (Home)**

* A camera viewfinder dominating the screen.
* Two toggle buttons at the bottom: "Scan Barcode" or "Scan Label manually".
* If manual: Overlay brackets guide the user to snap the Nutrition Facts and Ingredients list clearly.

**Screen 2: Processing...**

* *Microcopy:* "Reading labels..." -> "Spotting hidden sugars..." -> "Estimating Glycemic Load..."

**Screen 3: The Verdict (Results)**

* **The Scorecard (Traffic Light UI):**
* **Glycemic Load Estimate:** Displayed as a large number with a color code (Green: Low ≤10, Yellow: Med 11-19, Red: High ≥20).


* **The Sugar Breakdown (The MVP Magic):**
* Total Sugar: **14g** (Extracted from label)
* *Agent Alert!* Found hidden high-GI sugars: **Maltodextrin, High Fructose Corn Syrup** (Extracted by VLM from ingredients).


* **Actionable Context (Non-medical):** A brief, VLM-generated tip based on the macros. For example: *"This has high sugar but zero fiber. Pairing this with a protein or healthy fat (like nuts) can help slow glucose absorption."*

# **Sugar PAI — Presentation Content**

## **1\. Introduction**

**Background**

* Diabetes and prediabetes management in the Philippines depends heavily on reading nutrition labels correctly, but most labels don't show a glycemic index.  
* Existing apps (MyFitnessPal, Carb Manager, GoCoCo, mySugr) track sugar as one number or flag "hidden sugar" without saying what it does to blood glucose.  
* Filipino foods, especially kakanin, are underrepresented in most food databases and rarely carry any nutrition label at all.

**Problem Statement**

* No app turns a sugar breakdown into an actionable GI estimate at the point of purchase.  
* People with diabetes are left to guess whether "coco sugar" or "high fructose corn syrup" matters, without a fast way to check.

**Proposed Solution & Target Users**

* Sugar PAI: photograph a nutrition label or ingredients list, get back total sugar, sugar type, and an estimated GI with a low/medium/high flag.  
* Target users: Filipinos managing diabetes or prediabetes who need quick, on-the-spot label decisions, especially around local packaged snacks and kakanin.

---

## **2\. System Design**

**Core Features**

* Sugar gram extraction from the Nutrition Facts panel  
* Sugar type classification from the ingredients list (sucrose, fructose, HFCS, coco sugar, muscovado, honey)  
* Weighted GI estimate, cross-checked against Filipino and international food databases  
* Plain-language low/medium/high flag  
* Stretch goal: gluten flag from grain-based ingredients

**Dataset Overview**

* FNRI Philippine Food Composition Tables (PhilFCT) — primary source for local foods and kakanin  
* Trinidad et al. (2010) — measured GI values for 40 commonly consumed Filipino carbohydrate foods, used as ground truth  
* University of Sydney GI database / USDA FoodData Central — fallback for foods outside the local set  
* Open Food Facts — barcode/SKU cross-reference for packaged products

**System Architecture**

* Photo input → CV/DS label reader (VLM or OCR pipeline) → structured sugar data (grams \+ ingredient list)  
* RAG lookup against FNRI/GI database → GI estimate \+ flag  
* Guardrails layer → disclaimer, blocks medical-advice framing  
* Chat UI (Streamlit/Gradio) and REST API expose the same pipeline  
* LLMOps monitoring tracks latency, token usage, and extraction errors

---

## **3\. Methodology**

**Chosen Tech Stack**

* LLM / VLM: \[to be finalized — evaluating Gemini, GPT, and Claude vision models on real label photos\]  
* CV/OCR: VLM-based extraction, evaluated against traditional OCR as a fallback for cost-sensitive cases  
* Retrieval: RAG over FNRI PhilFCT \+ GI reference database  
* Backend/API: \[framework TBD, e.g. FastAPI\]  
* UI: \[Streamlit/Gradio TBD\]  
* LLMOps: \[MLflow or equivalent, TBD\]  
* Deployment: Docker

---

## **4\. Results & Discussion**

**Experiments**

* Unit test: sugar-gram extraction accuracy (MAE) against photographed labels, including poor-quality photos  
* GI estimation accuracy: our weighted estimate vs. Trinidad et al. measured GI values, and international GI references for packaged foods  
* End-to-end trajectory eval: does the full pipeline output the correct low/medium/high flag  
* LLM-as-judge: checks the plain-language explanation for overstated certainty or medical-advice framing

**Model Evaluation**

* \[Results table — MAE, GI accuracy %, trajectory pass rate — pending test set completion\]

**Challenges & Limitations**

* GI is a population average; individual responses vary  
* Sugar-type weighting ignores fiber, fat, and food matrix effects that also slow sugar absorption  
* Many kakanin have no printed label at all, so the label-reading pipeline can't reach them  
* VLM cost and latency vs. traditional OCR is a real tradeoff at scale, even if VLMs win on messy, real-world label photos

---

## **5\. What's Next**

* Build a food-recognition path (photo of the food itself, not just packaging) to cover unlabeled kakanin  
* Expand the reference database beyond the 40 Trinidad et al. foods  
* Add the gluten-flag stretch feature  
* Test with real users to validate the value proposition (time saved per grocery trip)  
* Refine cost/UoM estimates once real usage data exists

---

## **6\. System Demo**

* Live walkthrough: upload a label photo → sugar breakdown → GI estimate → flag  
* Fallback: screen recording, disclosed upfront per the course requirement

# Sugar PAI: Technical Write-Up

STAI100 \- Introduction to Agentic AI, Final Capstone Agent: Sugar PAI 

Team: Avelino, Sophia; Balingit, Andrei; Filipino, Audric

LLM: \[Model \+ parameter size \- TBD, see Section 3\]

## 1\. Business Case

Sugar PAI reads a photo of a nutrition label or ingredients list and tells a diabetic user two things: how much sugar is actually in the product, and what kind of sugar it is. From that, it estimates a glycemic index (GI) for the product and flags whether it fits a low-GI diet. The long-term target is Filipino packaged foods and kakanin, where GI labeling barely exists and where a lot of hidden sugar hides behind names like "coco sugar," "high fructose corn syrup," or "muscovado."

### Why this, not another calorie tracker??

We looked at what's already out there. MyFitnessPal, Carb Manager, and Cronometer log carbs and sugar totals well, but they treat sugar as one undifferentiated number. GoCoCo scans packaged foods and flags "hidden sugars" like fructose or dextrose, and gives a health score, but it stops at flagging; it doesn't compute or estimate a glycemic index. SNAQ estimates carbs from a photo of a meal and has published validation data (a 2024 study in the Journal of Diabetes Science and Technology reported it cut carb-estimation error by 38% versus manual counting), but it's meal-photo carb counting, not label-based sugar-type and GI estimation. mySugr and Glucose Buddy are logbooks for glucose and insulin, not label readers. None of them do the specific thing Sugar PAI does: read a label, classify the sugar type, and turn that into a GI estimate a diabetic person can act on before they buy the product.

Sanity check, per the course brief: could ChatGPT or a Google search alone do this? Not reliably. A generic chat model can explain what glycemic index means, but it can't read a physical label a user is holding in a grocery aisle, match a Filipino product against a food composition table, or consistently parse "sugar (from cane, coconut)" into a sugar-type breakdown without a grounded pipeline behind it. That's the gap Sugar PAI fills, and it's why this needs an agent with vision and retrieval, not a single prompt.

### Value proposition

The direct comparison point is a dietitian consult or diabetes education session focused on label literacy, which typically runs somewhere in the ₱500-800 range per session in the Philippines and covers maybe an hour of guidance. Sugar PAI doesn't replace that relationship, but it can absorb the repetitive part of it: the moment-by-moment "can I eat this" decision that happens in a grocery aisle, dozens of times a month, that a once-a-month consult can't cover. We haven't measured this yet, so treat it as a hypothesis to test in the eval phase, not a claim: if Sugar PAI cuts the time a user spends manually cross-checking labels from roughly 3-5 minutes per product to under 30 seconds, and a user checks 10 products a week, that's over 2 hours a month given back. We'll put a peso figure on that once we have real usage data.

There's also an intangible piece we're flagging explicitly as intangible, per the brief: reduced anxiety around grocery shopping for someone newly diagnosed with diabetes. We won't try to monetize that, but it's part of why this use case matters.

## 2\. Review of Related Literature and Model Selection

### 2.1 Reading the label: OCR pipeline vs. vision-language model

We looked at two broad approaches for the CV/DS component.

Traditional OCR (Tesseract, PaddleOCR, or a specialized model like PP-OCRv5) extracts raw text fast and cheap, but nutrition labels are a bad fit for classic OCR because of irregular table layouts, small print, and inconsistent formatting across brands. A 2026 comparison of document extraction tools found that traditional OCR software has high development effort and either a steep licensing cost or requires a lot of manual post-processing to turn raw text into structured fields, while a model like Gemini Flash can extract structured data from thousands of pages for a few dollars with far less engineering effort.

Vision-language models (Gemini, GPT-4o/GPT-5, Claude) read the label and the layout together, and can return structured JSON in one call instead of a raw-text-then-parse pipeline. A recent OCR benchmark (OCR Arena, early 2026\) put Gemini 3 Flash, Gemini 3 Pro, Claude Opus 4.6, and GPT-5.2 ahead of dedicated OCR engines on real, messy documents, with VLMs showing 3-4x lower character error rate on noisy or distorted text compared to classic OCR. That's exactly the failure mode we expect from a phone photo of a crumpled label in a sari-sari store.

The trade-off is cost and latency: OCR runs in milliseconds, a VLM call takes a few seconds and costs more per image. For Sugar PAI, that trade-off favors the VLM, because our use case is one photo at a time (a shopper checking a single product), not bulk document processing. We haven't locked in the specific model yet \- that decision depends on what's actually available and affordable for the team by the time we build this out, so consider this a placeholder to fill in once we've tested candidates side by side on real Filipino product labels.

### 2.2 Can GI be computed directly from sugar type and grams?

Partially, and only as an estimate, not a clinical measurement. The literature gives clean reference points: glucose has a GI of 100, sucrose (table sugar) sits at 65 because it's half glucose and half fructose, and fructose alone has a GI around 23-25. Coconut/coco sap sugar, common in Filipino cooking, has been measured at a low GI of roughly 35-42 in lab studies, which matters directly for kakanin.

But GI is properly defined through a clinical protocol: feeding 50g of available carbohydrate from a test food to real subjects and tracking their blood glucose response over two hours against a glucose reference, the method Jenkins and colleagues established. That's not something an agent can replicate from a label photo. What Sugar PAI can do is give a weighted GI estimate based on the known GI of the sugar types present and their proportions, which is a reasonable proxy but not a substitute for a lab-measured GI. We'll present it as "estimated GI" in the UI, with a visible disclaimer that this isn't medical advice and doesn't replace clinical GI testing.

Usefully, there's a directly relevant Filipino study: Trinidad et al. (2010) measured actual GI values for 40 commonly consumed Philippine carbohydrate foods, including sugars and syrups, biscuits, rice products, and starchy roots, tested on real subjects. That gives us a small but locally validated ground-truth set to check our sugar-type-weighted estimates against, at least for the foods it covers.

### 2.3 Data sources

For nutrient composition and sugar data on Filipino foods, the FNRI's Philippine Food Composition Tables (PhilFCT) is the primary reference; it's the country's official food composition database and includes kakanin and other local items that international databases skip. For foods not covered locally, we'll fall back to an international reference such as the University of Sydney's GI database or USDA FoodData Central. For barcode/SKU lookups on packaged products, Open Food Facts is a reasonable open dataset to check alongside whatever OCR/VLM output we get directly from the label, since not every product will have a barcode entry.

## 3\. Methodology

We're pivoting to proof-of-concept scope, per the brief, rather than trying to cover every food category. The minimum viable pipeline is:

1. User uploads or photographs a nutrition label.  
2. The CV/DS component extracts total sugar (grams) from the Nutrition Facts panel.  
3. The ingredients list is parsed for named sugar types (sucrose, fructose, glucose, dextrose, high-fructose corn syrup, coconut/coco sap sugar, muscovado, honey, etc.).  
4. A GI is estimated from the sugar-type mix, weighted by proportion where the label gives enough detail, and cross-checked against FNRI/GI database entries when the product or a close match is found by name.  
5. The result is returned as: total sugar (g), sugar type breakdown, estimated GI, and a plain-language flag (low/medium/high).

A stretch goal, once the minimum works reliably, is flagging gluten content by checking the ingredients list against known gluten-bearing grains (wheat, barley, rye), since that's a second dietary concern that shows up in the same ingredient-parsing step.

We're keeping this narrow deliberately. Trying to cover every food category, every diet restriction, and full meal-photo estimation in one semester would spread the team too thin and weaken the one thing this capstone needs to prove: that an agent can reliably turn a label photo into a usable sugar and GI estimate.

## 4\. System Architecture

Sugar PAI integrates six components across the three-person team, with CV/DS Domain Integration mandatory for the whole team.

The CV/DS component (mandatory, Component 14\) is the label/ingredients reader described in Section 2.1 and 3, returning structured sugar data from an image. RAG (Component 3\) handles retrieval from the FNRI PhilFCT and the fallback GI database, matching the recognized product or ingredient names to known GI values and nutrient data. Guardrails (Component 5\) keep the agent from giving anything that reads as medical advice, add a visible disclaimer on every GI estimate, and screen for off-topic queries. Simple Chat UI (Component 6\) is the Streamlit or Gradio front end where a user uploads a photo and gets the sugar/GI breakdown back in plain language. API Endpoint Deployment (Component 7\) exposes the same pipeline as a REST endpoint so the CV/DS \+ RAG logic isn't locked to the chat UI. Evals (Component 13\) covers the evaluation suite described in Section 5\.

We'll assign two components per member; exact ownership is still being finalized on our end, so the table below is a working draft, not final:

| Member | Components |
| ----- | ----- |
| Filipino | CV/DS Domain Integration (mandatory), Evals |
| Balingit | RAG (FNRI / GI database retrieval), API Endpoint Deployment |
| Avelino | Guardrails, Simple Chat UI |

Architecture diagram, LLMOps monitoring setup (MLflow or equivalent), and Dockerfile are to be added once the pipeline is stable enough to trace end to end.

## 5\. Experiments and Evaluation

The eval suite needs at least three quantitative metrics with interpretation, per the rubric. We're planning:

Unit-level accuracy: mean absolute error between the sugar grams the CV/DS component extracts and the true label value, tested against a held-out set of photographed labels (including some deliberately imperfect photos (glare, angle, low resolution) since that's the real-world condition this needs to survive).

GI estimation accuracy: comparing our weighted GI estimate against the Trinidad et al. (2010) measured GI values for the subset of Filipino foods that study covers, plus international GI database values for packaged products. This tells us how far our sugar-type-weighted estimate drifts from an actual measured GI.

Trajectory / end-to-end eval: does the full pipeline, from photo upload to final flag (low/medium/high), produce the correct classification, not just correct intermediate numbers. We'll also run an LLM-as-judge pass on the plain-language explanation the agent gives, checking it doesn't overstate certainty or slip into medical-advice territory.

All numbers here are placeholders until we run the actual tests. We'll fill in the results table once the pipeline is built out and we have a real test set of labels.

## 6\. Retrospective

GI is a population-average figure and varies by individual; a sugar-type-weighted estimate ignores matrix effects like fiber, fat, and food structure that also change how fast sugar hits the bloodstream; and a lot of Filipino kakanin sold fresh or unpackaged simply has no printed nutrition label to read, which means the label-reading pipeline alone can't cover that category \- a future version would need a food-recognition path that works from a photo of the food itself, not just its packaging.
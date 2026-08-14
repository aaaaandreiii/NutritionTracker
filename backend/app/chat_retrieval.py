from __future__ import annotations

import asyncio
import hashlib
import os
import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from .schemas import ChatProductContext, ChatSource


@dataclass(frozen=True)
class CuratedFragment:
    id: str
    title: str
    publisher: str
    url: str
    excerpt: str
    keywords: tuple[str, ...]
    strength: str = "strong"


CURATED_FRAGMENTS = (
    CuratedFragment(
        id="fda-nutrition-facts",
        title="How to Understand and Use the Nutrition Facts Label",
        publisher="U.S. Food and Drug Administration",
        url="https://www.fda.gov/food/nutrition-education-resources-materials/nutrition-facts-label",
        excerpt="Serving information provides the basis for the nutrient amounts on the label; compare the stated serving with the amount actually eaten.",
        keywords=("label", "serving", "servings", "carbohydrate", "fiber", "protein", "fat", "nutrition facts", "compare"),
    ),
    CuratedFragment(
        id="fda-added-sugars",
        title="Added Sugars on the Nutrition Facts Label",
        publisher="U.S. Food and Drug Administration",
        url="https://www.fda.gov/food/nutrition-facts-label/added-sugars-nutrition-facts-label",
        excerpt="Added sugars are included within total sugars and cover sugars added during processing as well as sugars from syrups, honey, and concentrated fruit or vegetable juices.",
        keywords=("added sugar", "added sugars", "total sugar", "total sugars", "syrup", "honey", "ingredient"),
    ),
    CuratedFragment(
        id="who-sugars-guideline",
        title="Guideline: Sugars intake for adults and children",
        publisher="World Health Organization",
        url="https://www.who.int/publications/i/item/9789241549028/",
        excerpt="WHO recommends reducing free sugars throughout the life course and keeping intake below ten percent of total energy, with a conditional suggestion below five percent.",
        keywords=("who", "free sugar", "free sugars", "guideline", "limit", "intake", "recommendation"),
    ),
    CuratedFragment(
        id="who-healthy-diet",
        title="Healthy diet",
        publisher="World Health Organization",
        url="https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
        excerpt="A healthy diet is varied and balanced; its exact composition depends on individual characteristics, cultural context, locally available foods, and dietary customs.",
        keywords=("healthy diet", "balance", "balanced", "diet", "meal", "fiber", "fruit", "vegetable", "whole grain"),
    ),
    CuratedFragment(
        id="sydney-gi-basics",
        title="About Glycemic Index",
        publisher="University of Sydney Glycemic Index Research Service",
        url="https://glycemicindex.com/about-gi/",
        excerpt="Glycemic index ranks carbohydrate foods by their effect on blood glucose under standardized testing; it is not determined from sugar grams on a package label.",
        keywords=("glycemic", "glycaemic", "gi", "gl", "blood glucose", "carbohydrate", "sugar grams"),
    ),
    CuratedFragment(
        id="diabetes-care-food-order",
        title="Food Order Has a Significant Impact on Postprandial Glucose",
        publisher="Diabetes Care",
        url="https://diabetesjournals.org/care/article/38/7/e98/30750/Food-Order-Has-a-Significant-Impact-on",
        excerpt="A small controlled study found lower post-meal glucose when vegetables and protein were eaten before carbohydrate, but this does not predict an individual's response.",
        keywords=("food order", "vegetables first", "protein first", "meal order", "postprandial"),
        strength="moderate",
    ),
    CuratedFragment(
        id="pmc-postmeal-walking",
        title="Post-meal walking and postprandial glycaemia",
        publisher="PubMed Central",
        url="https://pmc.ncbi.nlm.nih.gov/articles/PMC6267507/",
        excerpt="Research reviews suggest that light activity after a meal can affect post-meal glucose, with results depending on timing, population, and study design.",
        keywords=("walk", "walking", "exercise", "movement", "after meal", "post-meal", "postprandial"),
        strength="moderate",
    ),
    CuratedFragment(
        id="off-data-source",
        title="Open Food Facts data",
        publisher="Open Food Facts",
        url="https://world.openfoodfacts.org/data",
        excerpt="Open Food Facts is a collaborative food-products database. Product records can be incomplete or incorrect and should be checked against the current package label.",
        keywords=("open food facts", "database", "barcode", "product record", "nova", "nutri-score", "source"),
        strength="moderate",
    ),
)

ALLOWED_WEB_DOMAINS = (
    "fda.gov",
    "who.int",
    "glycemicindex.com",
    "diabetesjournals.org",
    "ncbi.nlm.nih.gov",
    "pmc.ncbi.nlm.nih.gov",
    "openfoodfacts.org",
)


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.casefold()))


def _score(fragment: CuratedFragment, question: str) -> int:
    lowered = question.casefold()
    question_tokens = _tokens(question)
    score = 0
    for keyword in fragment.keywords:
        if keyword in lowered:
            score += 4 if " " in keyword else 2
        score += len(_tokens(keyword) & question_tokens)
    return score


def _domain_allowed(url: str) -> bool:
    domain = (urlparse(url).hostname or "").casefold()
    return any(domain == allowed or domain.endswith(f".{allowed}") for allowed in ALLOWED_WEB_DOMAINS)


def _product_source(product: ChatProductContext) -> ChatSource:
    nutrient_labels = {
        "total_carbohydrate": "carbohydrate",
        "fiber": "fiber",
        "total_sugars": "total sugars",
        "added_sugars": "added sugars",
        "sugar_alcohols": "sugar alcohols",
        "protein": "protein",
        "fat": "fat",
    }
    declared = []
    for field, label in nutrient_labels.items():
        value = getattr(product.nutrients, field)
        declared.append(f"{label}: {value:g} g" if value is not None else f"{label}: not declared / unavailable")
    ingredients = f" Ingredients: {product.ingredients}." if product.ingredients else " Ingredients were not declared / unavailable."
    url = f"https://world.openfoodfacts.org/product/{product.barcode}" if product.barcode else None
    return ChatSource(
        id=f"product-{product.local_log_id}",
        index=1,
        type="product",
        relationship="direct",
        strength="strong",
        title=f"Validated label: {product.product_name}",
        publisher="Your locally saved Sugar pAI record",
        domain="Local device",
        url=url,
        excerpt=f"Per {product.serving_label or 'labeled serving'}: {'; '.join(declared)}.{ingredients}",
    )


def _curated_sources(question: str) -> list[ChatSource]:
    ranked = sorted(
        ((fragment, _score(fragment, question)) for fragment in CURATED_FRAGMENTS),
        key=lambda item: (-item[1], item[0].id),
    )
    positive = [item for item in ranked if item[1] > 0]
    if not positive:
        return []
    return [
        ChatSource(
            id=fragment.id,
            index=index,
            type="curated",
            relationship="supporting" if score >= 4 else "background",
            strength=fragment.strength,  # type: ignore[arg-type]
            title=fragment.title,
            publisher=fragment.publisher,
            domain=urlparse(fragment.url).hostname or "",
            url=fragment.url,
            excerpt=fragment.excerpt,
        )
        for index, (fragment, score) in enumerate(positive[:6], start=1)
    ]


async def _tavily_sources(question: str) -> tuple[list[ChatSource], str | None]:
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return [], None
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": question,
                    "search_depth": "advanced",
                    "max_results": 6,
                    "include_domains": list(ALLOWED_WEB_DOMAINS),
                },
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError, asyncio.TimeoutError):
        return [], "Live search was unavailable; the answer uses curated evidence only."

    sources = []
    for result in payload.get("results", []):
        url = str(result.get("url", ""))
        if not url or not _domain_allowed(url):
            continue
        excerpt = re.sub(r"\s+", " ", str(result.get("content", ""))).strip()[:700]
        if not excerpt:
            continue
        domain = urlparse(url).hostname or ""
        sources.append(ChatSource(
            id=f"web-{hashlib.sha256(url.encode('utf-8')).hexdigest()[:16]}",
            index=1,
            type="web",
            relationship="supporting",
            strength="moderate",
            title=str(result.get("title") or domain),
            publisher=domain,
            domain=domain,
            url=url,
            excerpt=excerpt,
        ))
    return sources, None


def _deduplicate(sources: list[ChatSource]) -> list[ChatSource]:
    seen: set[str] = set()
    output: list[ChatSource] = []
    for source in sources:
        key = (source.url or source.title).rstrip("/").casefold()
        if key in seen:
            continue
        seen.add(key)
        output.append(source.model_copy(update={"index": len(output) + 1}))
        if len(output) == 6:
            break
    return output


async def retrieve_evidence(question: str, product: ChatProductContext | None) -> tuple[list[ChatSource], list[str]]:
    sources = [_product_source(product)] if product else []
    curated = _curated_sources(question)
    sources.extend(curated)
    warnings: list[str] = []
    strong_coverage = sum(source.strength in {"strong", "moderate"} for source in curated)
    if strong_coverage < 2:
        web_sources, warning = await _tavily_sources(question)
        sources.extend(web_sources)
        if warning:
            warnings.append(warning)
    deduplicated = _deduplicate(sources)
    non_product = [source for source in deduplicated if source.type != "product"]
    if len(non_product) == 1 and non_product[0].strength == "weak":
        warnings.append("Only one weak supporting source was found; the response is intentionally limited.")
    return deduplicated, warnings

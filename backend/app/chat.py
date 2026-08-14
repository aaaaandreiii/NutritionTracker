from __future__ import annotations

import asyncio
import json
import os
import re
from collections.abc import AsyncIterator

import httpx

from .chat_retrieval import retrieve_evidence
from .schemas import ChatRequest, ChatSource


SAFETY_PATTERNS = (
    r"\b(diagnos(?:e|is)|treat(?:ment)?|cure)\b",
    r"\b(insulin|metformin|medication|medicine|dose|dosage)\b",
    r"\b(predict|prediction|spike my|my glucose|my blood sugar)\b",
    r"\b(can i eat|may i eat|safe for (?:a )?diabet|diabetic[- ]friendly|good for diabetes)\b",
)

CORE_TOPIC_TERMS = {
    "added sugar", "total sugar", "free sugar", "nutrition facts", "label", "serving",
    "carbohydrate", "fiber", "protein", "fat", "ingredient", "syrup", "sweetener",
    "glycemic", "glycaemic", "gi", "gl", "food order", "vegetables first", "walking",
    "exercise", "post-meal", "healthy diet", "nova", "nutri-score", "barcode",
    "snack", "snacks", "pairing", "pair with",
}

SAFETY_RESPONSE = (
    "I can’t diagnose, recommend treatment or medication/insulin changes, predict your personal glucose response, "
    "or decide whether a food is permitted for you. I can explain the validated label and cited general evidence. "
    "For an individual medical decision, use your care plan or ask a qualified clinician."
)

OUT_OF_SCOPE_RESPONSE = (
    "I don’t have relevant evidence in Sugar pAI’s curated scope for that question. Ask about a validated product label, "
    "added or free sugars, serving sizes, ingredients, glycemic-index concepts, food order, or post-meal movement."
)


def safety_refusal(question: str) -> str | None:
    lowered = question.casefold()
    return SAFETY_RESPONSE if any(re.search(pattern, lowered) for pattern in SAFETY_PATTERNS) else None


def in_scope(question: str, has_product: bool) -> bool:
    lowered = question.casefold()
    if has_product and any(term in lowered for term in ("this", "product", "it", "label", "ingredient", "serving")):
        return True
    return any(term in lowered for term in CORE_TOPIC_TERMS)


def _event(event_type: str, **payload: object) -> str:
    return f"data: {json.dumps({'type': event_type, **payload}, separators=(',', ':'))}\n\n"


def _prompt(request: ChatRequest, sources: list[ChatSource]) -> list[dict[str, str]]:
    source_text = "\n".join(
        f"[{source.index}] {source.title} ({source.publisher}): {source.excerpt}"
        for source in sources
    )
    system = (
        "You are Sugar pAI Evidence Chat, a narrow educational assistant. Answer only from the supplied evidence. "
        "Use concise Markdown. Cite every material claim with [n](#source-n), using only source numbers provided. "
        "Preserve unknown nutrition values as 'Not declared / unavailable'; never turn them into zero. "
        "Do not diagnose, prescribe, discuss medication or insulin changes, predict personal glucose, grant food permission, "
        "or call a food good/bad/safe for diabetes. State uncertainty and study limitations.\n\nEVIDENCE:\n"
        f"{source_text}"
    )
    messages = [{"role": "system", "content": system}]
    messages.extend({"role": turn.role, "content": turn.content} for turn in request.turns[-10:])
    messages.append({"role": "user", "content": request.question})
    return messages


async def stream_ollama(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("SUGAR_PAI_CHAT_MODEL") or os.getenv("SUGAR_PAI_VISION_MODEL", "gemma4:12b")
    timeout = float(os.getenv("SUGAR_PAI_CHAT_TIMEOUT_SECONDS", "120"))
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
        async with client.stream(
            "POST",
            f"{base_url}/api/chat",
            json={"model": model, "messages": messages, "stream": True, "options": {"temperature": 0.1}},
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                payload = json.loads(line)
                if payload.get("error"):
                    raise RuntimeError(str(payload["error"]))
                token = payload.get("message", {}).get("content", "")
                if token:
                    yield token
                if payload.get("done"):
                    break


async def chat_event_stream(request: ChatRequest) -> AsyncIterator[str]:
    yield _event("stage", stage="safety", label="Checking question scope")
    refusal = safety_refusal(request.question)
    if refusal:
        yield _event("sources", sources=[], warnings=["This request crosses Sugar pAI’s medical-safety boundary."])
        yield _event("delta", text=refusal)
        yield _event("done", finishReason="safety_refusal")
        return
    if not in_scope(request.question, request.product is not None):
        yield _event("sources", sources=[], warnings=["No in-scope evidence retrieval was attempted."])
        yield _event("delta", text=OUT_OF_SCOPE_RESPONSE)
        yield _event("done", finishReason="out_of_scope")
        return

    yield _event("stage", stage="retrieval", label="Finding product and curated evidence")
    sources, warnings = await retrieve_evidence(request.question, request.product)
    yield _event(
        "sources",
        sources=[source.model_dump(mode="json", by_alias=True) for source in sources],
        warnings=warnings,
    )
    if not sources:
        yield _event("delta", text="I couldn’t find evidence that supports an answer. Try a question about label values, ingredients, or one of Sugar pAI’s curated topics.")
        yield _event("done", finishReason="no_evidence")
        return

    yield _event("stage", stage="generation", label="Writing from the selected evidence")
    try:
        timeout_seconds = float(os.getenv("SUGAR_PAI_CHAT_TIMEOUT_SECONDS", "120"))
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        iterator = stream_ollama(_prompt(request, sources)).__aiter__()
        while True:
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0:
                raise asyncio.TimeoutError
            try:
                token = await asyncio.wait_for(iterator.__anext__(), timeout=remaining)
            except StopAsyncIteration:
                break
            yield _event("delta", text=token)
    except asyncio.TimeoutError:
        yield _event("error", code="model_timeout", message="The local model took too long to respond.", retryable=True)
        return
    except (httpx.HTTPError, json.JSONDecodeError, RuntimeError) as exc:
        yield _event("error", code="model_unavailable", message=f"The local model could not complete the answer: {exc}", retryable=True)
        return
    except asyncio.CancelledError:
        raise
    yield _event("done", finishReason="complete")

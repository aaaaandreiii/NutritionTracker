from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .ocr import OcrResult


DEFAULT_EXTRACTION_MODEL = "deepseek-v4-flash:cloud"
MIN_OCR_CHARS = 20


class LabelExtractionError(RuntimeError):
    pass


class ExtractedLabel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_name: str | None = None
    brand: str | None = None
    serving_size: float | None = Field(default=None, ge=0)
    serving_unit: str | None = None
    household_measure: str | None = None
    servings_per_container: float | None = Field(default=None, ge=0)
    total_carbohydrate: float | None = Field(default=None, ge=0)
    fiber: float | None = Field(default=None, ge=0)
    total_sugars: float | None = Field(default=None, ge=0)
    added_sugars: float | None = Field(default=None, ge=0)
    sugar_alcohols: float | None = Field(default=None, ge=0)
    protein: float | None = Field(default=None, ge=0)
    fat: float | None = Field(default=None, ge=0)
    raw_ingredients: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    notes: list[str] = Field(default_factory=list)

    @field_validator("*", mode="before")
    @classmethod
    def blank_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return None
        return value


@dataclass(frozen=True)
class ExtractionResult:
    label: ExtractedLabel
    model: str
    attempts: int
    latency_ms: int
    token_counts: dict[str, int]
    validation_failures: list[str]


SYSTEM_PROMPT = """You extract packaged-food label facts from OCR text.
Return exactly one JSON object and no prose.
Use this schema with snake_case keys:
{
  "product_name": string|null,
  "brand": string|null,
  "serving_size": number|null,
  "serving_unit": string|null,
  "household_measure": string|null,
  "servings_per_container": number|null,
  "total_carbohydrate": number|null,
  "fiber": number|null,
  "total_sugars": number|null,
  "added_sugars": number|null,
  "sugar_alcohols": number|null,
  "protein": number|null,
  "fat": number|null,
  "raw_ingredients": string|null,
  "confidence": number|null,
  "notes": string[]
}
Rules:
- Use null when a value is absent, cropped, ambiguous, or on a different serving basis.
- Numeric nutrients must be grams per labeled serving, not percentages.
- Do not infer zero from a missing declaration.
- Preserve ingredient text in printed order when visible.
- Do not provide medical advice, diabetes safety claims, or glucose predictions.
"""


def _user_prompt(ocr: OcrResult) -> str:
    panel_text = ocr.combined_text
    return (
        "Extract only facts visible in this OCR text. OCR can contain mistakes; leave uncertain values null.\n\n"
        f"{panel_text}"
    )


async def extract_label_fields(ocr: OcrResult) -> ExtractionResult:
    provider = os.getenv("LLM_PROVIDER", "ollama").casefold()
    if provider != "ollama":
        raise LabelExtractionError("LLM_PROVIDER must be 'ollama' for live DeepSeek extraction.")

    if len(ocr.combined_text) < MIN_OCR_CHARS:
        raise LabelExtractionError("OCR produced too little readable text for LLM extraction.")

    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("SUGAR_PAI_EXTRACTION_MODEL", DEFAULT_EXTRACTION_MODEL)
    timeout_seconds = float(os.getenv("SUGAR_PAI_LLM_TIMEOUT_SECONDS", "12"))
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _user_prompt(ocr)},
    ]

    started = time.perf_counter()
    validation_failures: list[str] = []
    token_counts = {"prompt_eval_count": 0, "eval_count": 0}
    last_error: str | None = None

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for attempt in range(1, 3):
            payload = {
                "model": model,
                "messages": messages,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0},
            }
            try:
                response = await client.post(f"{base_url}/api/chat", json=payload)
                response.raise_for_status()
                api_payload = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                raise LabelExtractionError(f"Ollama extraction request failed: {exc}") from exc

            token_counts["prompt_eval_count"] += int(api_payload.get("prompt_eval_count") or 0)
            token_counts["eval_count"] += int(api_payload.get("eval_count") or 0)
            content = str(api_payload.get("message", {}).get("content") or "")
            try:
                parsed = _parse_json_object(content)
                label = ExtractedLabel.model_validate(parsed)
                return ExtractionResult(
                    label=label,
                    model=model,
                    attempts=attempt,
                    latency_ms=round((time.perf_counter() - started) * 1000),
                    token_counts=token_counts,
                    validation_failures=validation_failures,
                )
            except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
                last_error = str(exc)
                validation_failures.append(last_error[:500])
                if attempt == 2:
                    break
                messages.extend(
                    [
                        {"role": "assistant", "content": content[:4000]},
                        {
                            "role": "user",
                            "content": (
                                "The previous response failed JSON/schema validation. "
                                "Return one corrected JSON object only. Validation error: "
                                f"{last_error[:1200]}"
                            ),
                        },
                    ]
                )

    raise LabelExtractionError(
        f"DeepSeek returned invalid label JSON after one retry: {last_error or 'unknown validation error'}"
    )


def _parse_json_object(content: str) -> dict[str, Any]:
    stripped = content.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", stripped, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        stripped = fenced.group(1).strip()
    if not stripped.startswith("{"):
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise json.JSONDecodeError("No JSON object found", stripped, 0)
        stripped = stripped[start : end + 1]
    parsed = json.loads(stripped)
    if not isinstance(parsed, dict):
        raise TypeError("Extraction response must be a JSON object.")
    return parsed

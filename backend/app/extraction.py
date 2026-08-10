from __future__ import annotations

import json
import os
import re
import time
from base64 import b64encode
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .ocr import OcrResult


DEFAULT_EXTRACTION_MODEL = "qwen2.5:latest"
DEFAULT_VISION_MODEL = "gemma4:12b"
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
    source: str = "ocr_llm"


SCHEMA_INSTRUCTIONS = """Use this schema with snake_case keys:
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


SYSTEM_PROMPT = f"""You extract packaged-food label facts from OCR text.
Return exactly one JSON object and no prose.
{SCHEMA_INSTRUCTIONS}"""


VISION_PROMPT = f"""You extract packaged-food label facts directly from photographed package panels.
Images are ordered by panel when available: nutrition facts, ingredients, then front label or barcode.
Return exactly one JSON object and no prose.
{SCHEMA_INSTRUCTIONS}"""


def _user_prompt(ocr: OcrResult) -> str:
    panel_text = ocr.combined_text
    return (
        "Extract only facts visible in this OCR text. OCR can contain mistakes; leave uncertain values null.\n\n"
        f"{panel_text}"
    )


async def extract_label_fields(ocr: OcrResult) -> ExtractionResult:
    provider = os.getenv("LLM_PROVIDER", "ollama").casefold()
    if provider != "ollama":
        raise LabelExtractionError("LLM_PROVIDER must be 'ollama' for live OCR+LLM extraction.")

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
                    source="ocr_llm",
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
        f"OCR+LLM extraction returned invalid label JSON after one retry: {last_error or 'unknown validation error'}"
    )


async def extract_label_fields_from_images(image_paths: dict[str, Path]) -> ExtractionResult:
    provider = os.getenv("LLM_PROVIDER", "ollama").casefold()
    if provider != "ollama":
        raise LabelExtractionError("LLM_PROVIDER must be 'ollama' for hosted vision extraction.")

    panels = [panel for panel in ("nutrition", "ingredients", "front") if panel in image_paths]
    if not panels:
        raise LabelExtractionError("No sanitized images were available for VLM extraction.")

    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("SUGAR_PAI_VISION_MODEL", DEFAULT_VISION_MODEL)
    timeout_seconds = float(os.getenv("SUGAR_PAI_VISION_TIMEOUT_SECONDS", "60"))
    images = [_image_to_base64(image_paths[panel]) for panel in panels]

    started = time.perf_counter()
    validation_failures: list[str] = []
    token_counts = {"prompt_eval_count": 0, "eval_count": 0}
    last_error: str | None = None

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for attempt in range(1, 3):
            prompt = VISION_PROMPT
            if last_error:
                prompt = (
                    f"{VISION_PROMPT}\nThe previous response failed JSON/schema validation. "
                    f"Return one corrected JSON object only. Validation error: {last_error[:1200]}"
                )
            payload = {
                "model": model,
                "prompt": prompt,
                "images": images,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0},
            }
            try:
                response = await client.post(f"{base_url}/api/generate", json=payload)
                response.raise_for_status()
                api_payload = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                raise LabelExtractionError(f"Ollama vision extraction request failed: {exc}") from exc

            token_counts["prompt_eval_count"] += int(api_payload.get("prompt_eval_count") or 0)
            token_counts["eval_count"] += int(api_payload.get("eval_count") or 0)
            content = str(api_payload.get("response") or "")
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
                    source="vlm",
                )
            except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
                last_error = str(exc)
                validation_failures.append(last_error[:500])
                if attempt == 2:
                    break

    raise LabelExtractionError(
        f"VLM extraction returned invalid label JSON after one retry: {last_error or 'unknown validation error'}"
    )


def _image_to_base64(path: Path) -> str:
    return b64encode(path.read_bytes()).decode("ascii")


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

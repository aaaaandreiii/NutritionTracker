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
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


DEFAULT_MEAL_VISION_MODEL = "gemma4:12b"
MAX_MEAL_COMPONENTS = 12


class MealImageError(RuntimeError):
    pass


class DetectedMealComponent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    food_name: str = Field(min_length=1, max_length=250)
    preparation_clues: list[str] = Field(default_factory=list, max_length=12)
    household_portion: str = Field(min_length=1, max_length=160)
    gram_min: float = Field(ge=1, le=5000, allow_inf_nan=False)
    gram_max: float = Field(ge=1, le=5000, allow_inf_nan=False)
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_gram_order(self) -> "DetectedMealComponent":
        if self.gram_min > self.gram_max:
            raise ValueError("gram_min must not exceed gram_max")
        return self


class DetectedMeal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    components: list[DetectedMealComponent] = Field(min_length=1, max_length=MAX_MEAL_COMPONENTS)


@dataclass(frozen=True)
class MealImageResult:
    meal: DetectedMeal
    model: str
    attempts: int
    latency_ms: int
    token_counts: dict[str, int]
    validation_failures: list[str]


MEAL_IMAGE_SCHEMA = """{
  "components": [
    {
      "food_name": string,
      "preparation_clues": string[],
      "household_portion": string,
      "gram_min": number,
      "gram_max": number,
      "confidence": number
    }
  ]
}"""

MEAL_IMAGE_PROMPT = f"""Identify visible food components in this meal photo.
Return exactly one JSON object and no prose, using this schema:
{MEAL_IMAGE_SCHEMA}
Rules:
- Split visibly distinct foods, sauces, drinks, and toppings into separate components.
- Include no more than {MAX_MEAL_COMPONENTS} components.
- Describe only visible preparation clues; do not invent ingredients.
- Give a household portion and a conservative 1–5000 g visual range for each component.
- Confidence is 0–1 and reflects food identity, not nutritional quality.
- NEVER return calories, carbohydrate, sugar, fiber, protein, fat, GI, GL, nutrient values, health claims, or glucose predictions.
"""


async def extract_meal_components_from_image(image_path: Path) -> MealImageResult:
    if os.getenv("LLM_PROVIDER", "ollama").casefold() != "ollama":
        raise MealImageError("LLM_PROVIDER must be 'ollama' for meal-image identification.")
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("SUGAR_PAI_MEAL_VISION_MODEL", os.getenv("SUGAR_PAI_VISION_MODEL", DEFAULT_MEAL_VISION_MODEL))
    timeout_seconds = float(os.getenv("SUGAR_PAI_MEAL_VISION_TIMEOUT_SECONDS", os.getenv("SUGAR_PAI_VISION_TIMEOUT_SECONDS", "120")))
    image = b64encode(image_path.read_bytes()).decode("ascii")
    started = time.perf_counter()
    validation_failures: list[str] = []
    token_counts = {"prompt_eval_count": 0, "eval_count": 0}
    last_error: str | None = None

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds)) as client:
        for attempt in range(1, 3):
            prompt = MEAL_IMAGE_PROMPT
            if last_error:
                prompt += (
                    "\nThe previous output failed the strict schema. Return one corrected JSON object only. "
                    f"Validation error: {last_error[:1000]}"
                )
            try:
                response = await client.post(
                    f"{base_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "images": [image],
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0},
                    },
                )
                response.raise_for_status()
                payload = response.json()
            except httpx.TimeoutException as exc:
                raise MealImageError(f"Ollama meal-image identification timed out after {timeout_seconds:g}s.") from exc
            except httpx.HTTPStatusError as exc:
                raise MealImageError(f"Ollama meal-image identification failed with HTTP {exc.response.status_code}.") from exc
            except (httpx.HTTPError, ValueError) as exc:
                raise MealImageError("Ollama meal-image identification is unavailable.") from exc

            token_counts["prompt_eval_count"] += int(payload.get("prompt_eval_count") or 0)
            token_counts["eval_count"] += int(payload.get("eval_count") or 0)
            try:
                parsed = _parse_json_object(str(payload.get("response") or ""))
                meal = DetectedMeal.model_validate(parsed)
                return MealImageResult(
                    meal=meal,
                    model=model,
                    attempts=attempt,
                    latency_ms=round((time.perf_counter() - started) * 1000),
                    token_counts=token_counts,
                    validation_failures=validation_failures,
                )
            except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
                last_error = str(exc)
                validation_failures.append(last_error[:500])

    raise MealImageError(
        f"Meal-image identification returned invalid JSON after one retry: {last_error or 'unknown validation error'}"
    )


def confidence_band(confidence: float) -> str:
    if confidence >= 0.8:
        return "high"
    if confidence >= 0.55:
        return "medium"
    return "low"


def _parse_json_object(content: str) -> dict[str, Any]:
    stripped = content.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", stripped, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        stripped = fenced.group(1).strip()
    if not stripped.startswith("{"):
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end <= start:
            raise json.JSONDecodeError("No JSON object found", stripped, 0)
        stripped = stripped[start : end + 1]
    parsed = json.loads(stripped)
    if not isinstance(parsed, dict):
        raise TypeError("Meal-image response must be a JSON object.")
    return parsed

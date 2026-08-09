from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from PIL import Image


OcrProvider = Literal["tesseract", "paddle"]


class OcrProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class OcrResult:
    provider: OcrProvider
    text_by_panel: dict[str, str]
    latency_ms: int

    @property
    def combined_text(self) -> str:
        return "\n\n".join(
            f"[{panel}]\n{text.strip()}"
            for panel, text in self.text_by_panel.items()
            if text.strip()
        ).strip()


def configured_ocr_provider() -> OcrProvider:
    provider = os.getenv("SUGAR_PAI_OCR_PROVIDER", "tesseract").casefold()
    if provider not in {"tesseract", "paddle"}:
        raise OcrProviderError(
            "SUGAR_PAI_OCR_PROVIDER must be 'tesseract' or 'paddle'."
        )
    return provider  # type: ignore[return-value]


async def extract_text_from_images(image_paths: dict[str, Path]) -> OcrResult:
    provider = configured_ocr_provider()
    started = time.perf_counter()
    if provider == "tesseract":
        text_by_panel = await asyncio.to_thread(_extract_with_tesseract, image_paths)
    else:
        text_by_panel = await asyncio.to_thread(_extract_with_paddle, image_paths)
    return OcrResult(
        provider=provider,
        text_by_panel=text_by_panel,
        latency_ms=round((time.perf_counter() - started) * 1000),
    )


def _extract_with_tesseract(image_paths: dict[str, Path]) -> dict[str, str]:
    try:
        import pytesseract
    except ImportError as exc:
        raise OcrProviderError(
            "Tesseract OCR provider selected but pytesseract is not installed."
        ) from exc

    text_by_panel: dict[str, str] = {}
    for panel, path in image_paths.items():
        try:
            with Image.open(path) as image:
                text_by_panel[panel] = pytesseract.image_to_string(
                    image,
                    config="--psm 6",
                ).strip()
        except pytesseract.TesseractNotFoundError as exc:
            raise OcrProviderError(
                "Tesseract OCR provider selected but the tesseract binary is not installed."
            ) from exc
        except pytesseract.TesseractError as exc:
            raise OcrProviderError(f"Tesseract OCR failed: {exc}") from exc
        except OSError as exc:
            raise OcrProviderError(f"Tesseract could not read the sanitized image: {exc}") from exc
    return text_by_panel


def _extract_with_paddle(image_paths: dict[str, Path]) -> dict[str, str]:
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise OcrProviderError(
            "PaddleOCR provider selected but paddleocr is not installed. "
            "Install PaddleOCR or set SUGAR_PAI_OCR_PROVIDER=tesseract."
        ) from exc

    ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    text_by_panel: dict[str, str] = {}
    for panel, path in image_paths.items():
        try:
            rows = ocr.ocr(str(path), cls=True)
        except Exception as exc:
            raise OcrProviderError(f"PaddleOCR failed: {exc}") from exc
        words: list[str] = []
        for page in rows or []:
            for item in page or []:
                if len(item) >= 2 and isinstance(item[1], (list, tuple)) and item[1]:
                    words.append(str(item[1][0]))
        text_by_panel[panel] = "\n".join(words).strip()
    return text_by_panel

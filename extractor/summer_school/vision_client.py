"""Vision client interface for Summer School page extraction.

The existing ``extractor/vision_client.py`` scaffold is a stub and is NOT the
pipeline that produced the regular catalog (the regular catalog was produced by
rule-based parsing in ``backend/src/rules/`` / ``backend/scripts/rule_extract_book.py``).
This module defines the smallest clean abstraction Summer School extraction
needs: one method that turns a single PNG page into a structured page result.

Adapters
--------
``stub`` (default) — safe, non-hallucinating; returns an empty page result.  Used
to exercise the pipeline shape without any vision model.

``openai`` — real vision extraction via the OpenAI Responses API (the same
provider and endpoint the project already uses for the regular-catalog AI
extraction scripts, ``OPENAI_API_KEY`` / ``OPENAI_MODEL`` environment
variables).  The PNG is sent base64-encoded as an ``input_image`` alongside the
Phase 2 extraction prompt in ``prompts/summer-page.md``.

Select with the existing ``EXTRACTOR_VISION_MODE`` environment variable.
"""
from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from . import schema
from . import config

PAGE_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "summer-page.md")

OPENAI_ENDPOINT = "https://api.openai.com/v1/responses"
DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"  # matches backend/scripts/extract_page.py convention
# Keep the request payload small/reliable: cap the image dimension we send.
MAX_IMAGE_DIMENSION = 1568


class SummerSchoolVisionClient:
    """Interface: given a PNG page, produce a structured page extraction result.

    Concrete providers *must* preserve the page number in ``sourceReference``
    and *must not* fabricate field values.  Anything they cannot read from the
    image should be recorded as ``status: "unclear"`` extraction issues.
    """

    def __init__(
        self,
        mode: str = "stub",
        *,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> None:
        self.mode = mode
        self.model = model or os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")

    def extract_page(self, image_path: str, page_number: int) -> schema.PageExtractionResult:
        """Return the structured extraction for one PNG page."""
        if self.mode == "stub":
            return self._stub_extract(image_path, page_number)
        if self.mode == "openai":
            return self._openai_extract(image_path, page_number)
        raise NotImplementedError(f"Vision mode {self.mode!r} is not implemented.")

    # ------------------------------------------------------------------
    # Stub (safe, non-hallucinating): returns an empty page result.  Used to
    # exercise the pipeline shape and tests without any vision model.
    # ------------------------------------------------------------------

    def _stub_extract(self, image_path: str, page_number: int) -> schema.PageExtractionResult:
        return schema.PageExtractionResult(
            sourceReference={
                "file": config.SOURCE_PDF_NAME,
                "page": page_number,
            },
            courses=[],
            warnings=[f"stub extraction for {os.path.basename(image_path)}"],
        )

    # ------------------------------------------------------------------
    # OpenAI vision adapter
    # ------------------------------------------------------------------

    def _openai_extract(self, image_path: str, page_number: int) -> schema.PageExtractionResult:
        if not self.api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. Set it to run with EXTRACTOR_VISION_MODE=openai."
            )
        prompt = self.load_prompt()
        if not prompt:
            raise RuntimeError(f"Extraction prompt not found at {PAGE_PROMPT_PATH}")

        image_data_url = self._encode_image(image_path)
        payload = {
            "model": self.model,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {"type": "input_image", "image_url": image_data_url, "detail": "high"},
                    ],
                }
            ],
            "text": {"format": {"type": "json_object"}},
        }

        request = urllib.request.Request(
            OPENAI_ENDPOINT,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"OpenAI vision request failed: {exc.code} {body}") from exc

        output_text = self._response_output_text(result)
        try:
            raw = json.loads(output_text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"OpenAI vision returned non-JSON output for page {page_number}: {output_text[:200]}"
            ) from exc

        return self._normalize(raw, page_number)

    def _encode_image(self, image_path: str) -> str:
        """Return a base64 data URL for the page image, downscaled if huge.

        Keeps the request small for large 300 DPI pages while preserving enough
        detail for text reading.
        """
        try:
            import fitz  # PyMuPDF (already used by the renderer)
        except ImportError:
            fitz = None

        with open(image_path, "rb") as fh:
            raw = fh.read()

        if fitz is not None:
            try:
                doc = fitz.open(image_path)
                page = doc.load_page(0)
                pix = page.get_pixmap()
                if max(pix.width, pix.height) > MAX_IMAGE_DIMENSION:
                    scale = MAX_IMAGE_DIMENSION / max(pix.width, pix.height)
                    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale))
                jpeg_bytes = pix.tobytes("jpeg", jpg_quality=92)
                doc.close()
                raw = jpeg_bytes
                mime = "image/jpeg"
            except Exception:
                raw = raw
                mime = "image/png"
        else:
            mime = "image/png"

        return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"

    @staticmethod
    def _response_output_text(result: Dict[str, Any]) -> str:
        output_text = result.get("output_text")
        if output_text:
            return str(output_text)
        parts: List[str] = []
        for item in result.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in {"output_text", "text"}:
                    parts.append(str(content.get("text", "")))
        return "".join(parts)

    def _normalize(
        self, raw: Dict[str, Any], page_number: int
    ) -> schema.PageExtractionResult:
        """Coerce the model response to the documented page-result shape.

        The page number is always taken from the framework (never trusted from
        the model).  Non-list fields fall back to safe empty values instead of
        crashing the pipeline.
        """
        courses = raw.get("courses")
        if not isinstance(courses, list):
            courses = []
        warnings = raw.get("warnings")
        if not isinstance(warnings, list):
            warnings = [f"model returned unexpected shape for page {page_number}"]
        return schema.PageExtractionResult(
            sourceReference={
                "file": raw.get("sourceReference", {}).get("file", config.SOURCE_PDF_NAME)
                if isinstance(raw.get("sourceReference"), dict)
                else config.SOURCE_PDF_NAME,
                "page": page_number,
            },
            courses=[c for c in courses if isinstance(c, dict)],
            warnings=[str(w) for w in warnings],
        )

    # ------------------------------------------------------------------
    # Helpers shared by real providers
    # ------------------------------------------------------------------

    def load_prompt(self) -> Optional[str]:
        try:
            with open(PAGE_PROMPT_PATH, "r", encoding="utf-8") as fh:
                return fh.read()
        except FileNotFoundError:
            return None


def _extract_page_json(client: SummerSchoolVisionClient, image_path: str, page_number: int) -> Dict[str, Any]:
    result = client.extract_page(image_path, page_number)
    return {
        "sourceReference": json.dumps(result.get("sourceReference")),
        "courses": result.get("courses", []),
        "warnings": result.get("warnings", []),
    }


def get_summer_client() -> SummerSchoolVisionClient:
    """Build the client selected by ``EXTRACTOR_VISION_MODE``.

    Modes:
      * ``stub``  — safe empty extraction (default, no network/API key needed).
      * ``openai`` — real vision extraction using OPENAI_API_KEY / OPENAI_MODEL.
    """
    mode = os.environ.get("EXTRACTOR_VISION_MODE", "stub")
    return SummerSchoolVisionClient(mode=mode)
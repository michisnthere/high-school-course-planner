"""Extract one page image into structured JSON via the vision client.

This module is intentionally small and deterministic: it does not perform any text-based
parsing in Python. The vision model is responsible for reading the image and returning
valid JSON matching the existing schema.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

from vision_client import get_client

PROMPT_DIR = os.path.join(os.path.dirname(__file__), "prompts")
PAGE_PROMPT_PATH = os.path.join(PROMPT_DIR, "page.md")


def load_prompt() -> Optional[str]:
    try:
        with open(PAGE_PROMPT_PATH, "r", encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        return None


def extract_page(image_path: str, section_type: str, section_id: str) -> Dict[str, Any]:
    prompt = load_prompt()
    client = get_client()
    data = client.extract_page(image_path, prompt=prompt)
    # Enforce the expected schema keys by normalizing missing sections.
    return {
        "departments": data.get("departments", []),
        "courses": data.get("courses", []),
        "graduationRequirements": data.get("graduationRequirements", []),
        "warnings": data.get("warnings", []),
    }


def write_page_json(page_number: int, page_data: Dict[str, Any], out_dir: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"page_{page_number:03d}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(page_data, fh, indent=2, ensure_ascii=False)

"""Extractor for course-detail sections.
"""
from __future__ import annotations

from typing import Any, Dict, List
from .vision_client import get_client
import json
import os

PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "course.md")


def extract_course_section(image_paths: List[str]) -> Dict[str, Any]:
    client = get_client()
    prompt = None
    try:
        with open(PROMPT_PATH, "r", encoding="utf-8") as fh:
            prompt = fh.read()
    except Exception:
        prompt = None
    result = client.extract_section(image_paths, prompt=prompt)
    return result

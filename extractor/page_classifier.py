"""Simple page classifier wrapper.

This module delegates to `vision_client`. For this minimal pipeline the `sections.json`
already contains section groupings and types, so the classifier is optional. It's
provided here to support future evolution where per-page classification may be desired.
"""
from __future__ import annotations

from typing import List, Optional
from .vision_client import get_client


def classify_page(image_path: str) -> str:
    client = get_client()
    return client.classify_pages([image_path])


def classify_pages(image_paths: List[str]) -> List[str]:
    client = get_client()
    label = client.classify_pages(image_paths)
    return [label for _ in image_paths]

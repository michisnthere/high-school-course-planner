"""Combine page JSON files into a section JSON file.

This module preserves original page order and performs no semantic merging.
"""
from __future__ import annotations

import json
import os
from typing import List, Dict, Any


def combine_pages(section_id: str, page_numbers: List[int], page_dir: str, section_dir: str) -> str:
    os.makedirs(section_dir, exist_ok=True)
    combined = {"departments": [], "courses": [], "graduationRequirements": [], "warnings": []}

    for page_number in sorted(page_numbers):
        page_path = os.path.join(page_dir, f"page_{page_number:03d}.json")
        with open(page_path, "r", encoding="utf-8") as fh:
            page_data = json.load(fh)
        combined["departments"].extend(page_data.get("departments", []))
        combined["courses"].extend(page_data.get("courses", []))
        combined["graduationRequirements"].extend(page_data.get("graduationRequirements", []))
        combined["warnings"].extend(page_data.get("warnings", []))

    section_path = os.path.join(section_dir, f"{section_id}.json")
    with open(section_path, "w", encoding="utf-8") as fh:
        json.dump(combined, fh, indent=2, ensure_ascii=False)
    return section_path

"""Combine section JSON files into the final academic-data.json catalog."""
from __future__ import annotations

import json
import os
from typing import Dict, Any


def combine_sections(section_dir: str, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    combined: Dict[str, Any] = {"departments": [], "courses": [], "graduationRequirements": [], "warnings": []}

    for file_name in sorted(os.listdir(section_dir)):
        if not file_name.endswith(".json"):
            continue
        path = os.path.join(section_dir, file_name)
        with open(path, "r", encoding="utf-8") as fh:
            section_data = json.load(fh)
        combined["departments"].extend(section_data.get("departments", []))
        combined["courses"].extend(section_data.get("courses", []))
        combined["graduationRequirements"].extend(section_data.get("graduationRequirements", []))
        combined["warnings"].extend(section_data.get("warnings", []))

    final_path = os.path.join(output_dir, "academic-data.json")
    with open(final_path, "w", encoding="utf-8") as fh:
        json.dump(combined, fh, indent=2, ensure_ascii=False)
    return final_path

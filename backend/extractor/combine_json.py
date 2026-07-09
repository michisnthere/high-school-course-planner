"""Combine per-section JSON files into a single academic-data.json file.

This module is intentionally tiny — `run_pipeline.py` already performs the combine step,
but this script can be used standalone to merge any JSON files in `extractor/output/`.
"""
from __future__ import annotations

import json
import os
from typing import Dict, Any

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def combine(output_dir: str = OUTPUT_DIR) -> Dict[str, Any]:
    combined = {"departments": [], "courses": [], "graduationRequirements": [], "warnings": []}
    for name in os.listdir(output_dir):
        if not name.endswith(".json"):
            continue
        path = os.path.join(output_dir, name)
        with open(path, "r", encoding="utf-8") as fh:
            sec = json.load(fh)
        combined["departments"].extend(sec.get("departments", []))
        combined["courses"].extend(sec.get("courses", []))
        combined["graduationRequirements"].extend(sec.get("graduationRequirements", []))
        combined["warnings"].extend(sec.get("warnings", []))
    out = os.path.join(output_dir, "academic-data.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(combined, fh, indent=2, ensure_ascii=False)
    return combined


if __name__ == "__main__":
    print("Combining JSON in", OUTPUT_DIR)
    combine()

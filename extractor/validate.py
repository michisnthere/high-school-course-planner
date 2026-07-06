"""Validate the combined academic-data JSON against basic expectations."""
from __future__ import annotations

import json
import os
from typing import Any, Dict


def validate_catalog(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        catalog = json.load(fh)

    courses = catalog.get("courses", [])
    offerings = []
    for course in courses:
        for offering in course.get("offerings", []):
            offerings.append(offering)

    problems = []
    if len(courses) != 225:
        problems.append(f"Expected 225 courses, found {len(courses)}.")
    if len(offerings) != 452:
        problems.append(f"Expected 452 offerings, found {len(offerings)}.")

    return {
        "valid": not problems,
        "problems": problems,
        "courseCount": len(courses),
        "offeringCount": len(offerings),
    }


if __name__ == "__main__":
    path = os.path.join(os.path.dirname(__file__), "output", "academic-data.json")
    result = validate_catalog(path)
    print(json.dumps(result, indent=2))

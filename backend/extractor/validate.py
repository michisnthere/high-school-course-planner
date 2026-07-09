"""Validate the combined academic catalog against the finalized schema.

Checks:
- Every course has a title.
- Courses have either choices or offerings, never both.
- Multi-choice courses do not carry per-version metadata on the parent.
- Each choice is self-contained with name, isOnline, creditType, credits, gpaWaiverOption,
  and offerings.
- Offerings contain only semester-specific data (no creditType, credits, corequisites).
- Notes are always present as arrays (empty arrays are allowed).
- No legacy fields (options, isOnline, corequisites) remain at the course level.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _ensure_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _validate_offering(offering: Dict[str, Any], prefix: str) -> List[str]:
    errors: List[str] = []
    for forbidden in ("creditType", "credits", "corequisites"):
        if forbidden in offering:
            errors.append(f"{prefix}: offering contains forbidden field '{forbidden}'")
    if not isinstance(offering.get("prerequisites"), list):
        errors.append(f"{prefix}: offering prerequisites must be a list")
    grade_levels = offering.get("gradeLevels")
    if not isinstance(grade_levels, list) or grade_levels != sorted(set(grade_levels)):
        errors.append(f"{prefix}: offering gradeLevels must be a sorted list of unique integers")
    if "notes" in offering and not isinstance(offering["notes"], list):
        errors.append(f"{prefix}: offering notes must be a list")
    return errors


def _validate_course(course: Dict[str, Any], path: Path, idx: int) -> List[str]:
    errors: List[str] = []
    prefix = f"{path}: course[{idx}] ({course.get('title', '<no title>')})"

    if not course.get("title"):
        errors.append(f"{prefix}: missing title")

    if "fulfillsRequirements" not in course:
        errors.append(f"{prefix}: missing fulfillsRequirements")
    elif not isinstance(course.get("fulfillsRequirements"), list):
        errors.append(f"{prefix}: fulfillsRequirements must be a list")

    for forbidden in ("options", "isOnline", "corequisites"):
        if forbidden in course:
            errors.append(f"{prefix}: forbidden field '{forbidden}' at course level")

    has_choices = bool(course.get("choices"))
    has_offerings = bool(course.get("offerings"))
    valid_credit_types = {"College Prep", "Accelerated", "Honors", "AP", None}

    if has_choices and has_offerings:
        errors.append(f"{prefix}: course has both choices and offerings")

    if not isinstance(course.get("notes"), list):
        errors.append(f"{prefix}: course notes must be a list")

    if has_choices:
        for forbidden in ("creditType", "credits", "gpaWaiverOption"):
            if forbidden in course:
                errors.append(f"{prefix}: parent course should not contain '{forbidden}' when choices exist")
        if len(course["choices"]) < 2:
            errors.append(f"{prefix}: single-choice course should be collapsed to the parent")
        for ch_idx, choice in enumerate(course["choices"]):
            ch_prefix = f"{prefix}: choice[{ch_idx}] ({choice.get('name', '<no name>')})"
            for required in ("name", "isOnline", "creditType", "credits", "gpaWaiverOption", "offerings"):
                if required not in choice:
                    errors.append(f"{ch_prefix}: missing required field '{required}'")
            if choice.get("creditType") not in valid_credit_types:
                errors.append(f"{ch_prefix}: creditType must be a known academic weight or null")
            if "notes" in choice and not isinstance(choice["notes"], list):
                errors.append(f"{ch_prefix}: choice notes must be a list")
            for o_idx, offering in enumerate(choice.get("offerings", [])):
                errors.extend(_validate_offering(offering, f"{ch_prefix}: offering[{o_idx}]"))
    elif has_offerings:
        for required in ("creditType", "credits", "gpaWaiverOption"):
            if required not in course:
                errors.append(f"{prefix}: single-version course missing '{required}'")
        if course.get("creditType") not in valid_credit_types:
            errors.append(f"{prefix}: creditType must be a known academic weight or null")
        for o_idx, offering in enumerate(course["offerings"]):
            errors.extend(_validate_offering(offering, f"{prefix}: offering[{o_idx}]"))
    else:
        errors.append(f"{prefix}: course has neither choices nor offerings")

    return errors


def validate_catalog(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        catalog = json.load(fh)

    courses = catalog.get("courses", [])
    errors: List[str] = []
    total_offerings = 0

    for idx, course in enumerate(courses):
        errors.extend(_validate_course(course, Path(path), idx))
        total_offerings += len(course.get("offerings", []))
        for ch in course.get("choices", []):
            total_offerings += len(ch.get("offerings", []))

    return {
        "valid": not errors,
        "problems": errors,
        "courseCount": len(courses),
        "offeringCount": total_offerings,
    }


def validate_all_targets() -> Dict[str, Any]:
    targets = [
        PROJECT_ROOT / "extractor" / "output" / "academic-data.json",
    ] + sorted((PROJECT_ROOT / "extractor" / "section_output").glob("*.json")) + sorted(
        (PROJECT_ROOT / "extractor" / "page_output").glob("*.json")
    )

    all_problems: List[str] = []
    total_courses = 0
    total_offerings = 0

    for path in targets:
        if not path.exists():
            continue
        result = validate_catalog(str(path))
        total_courses += result["courseCount"]
        total_offerings += result["offeringCount"]
        all_problems.extend(result["problems"])

    return {
        "valid": not all_problems,
        "problems": all_problems,
        "totalCourseCount": total_courses,
        "totalOfferingCount": total_offerings,
    }


if __name__ == "__main__":
    path = os.path.join(os.path.dirname(__file__), "output", "academic-data.json")
    result = validate_catalog(path)
    print(json.dumps(result, indent=2))

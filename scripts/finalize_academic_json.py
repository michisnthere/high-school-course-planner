#!/usr/bin/env python3
"""Finalize the academic catalog JSON schema for database import.

Targets:
  - extractor/output/academic-data.json
  - extractor/section_output/*.json
  - extractor/page_output/*.json

Finalized schema rules:
  1. The only alternate-version abstraction is `choices`. Legacy `options` arrays are
     converted into `choices`.
  2. Choices are used only when a course has more than one version. Single-version
     courses store scheduling/credit fields directly on the course.
  3. Parent courses contain only shared data (title, description, department,
     sourceReference, notes). For single-version courses, they also hold creditType,
     credits, gpaWaiverOption, and offerings.
  4. Each choice is self-contained with: name, isOnline, creditType, credits,
     gpaWaiverOption, and offerings.
  5. Offerings contain only semester-specific info: courseCode, semesterLabel,
     duration, gradeLevels, prerequisites, and optional notes. creditType/credits are
     removed from offerings.
  6. Empty optional arrays are omitted; prerequisites arrays are kept (even if empty).
  7. Existing canonical values (course codes, descriptions, credits, departments,
     grade levels, durations, prerequisite text, source references) are not changed.

After writing, every target file is validated against the finalized schema.
"""
from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent

TARGET_GLOBS = [
    "extractor/output/academic-data.json",
    "extractor/section_output/*.json",
    "extractor/page_output/*.json",
]

PERIOD_15_RE = re.compile(r"1\.5\s*period", re.IGNORECASE)
FULL_YEAR_RE = re.compile(r"full\s*year|year\s*long", re.IGNORECASE)
DURATION_RE = re.compile(r"semester", re.IGNORECASE)
SEMESTER_LABEL_RE = re.compile(r"semester\s*(1|2)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ensure_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _dedupe(items: List[Any]) -> List[Any]:
    seen = set()
    result = []
    for item in items:
        key = item if isinstance(item, (str, int, float, bool)) else json.dumps(item, sort_keys=True)
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def _sort_grade_levels(value: Any) -> List[int]:
    levels = []
    for v in _ensure_list(value):
        try:
            levels.append(int(v))
        except (ValueError, TypeError):
            continue
    return sorted(set(levels))


def _default_credit(description: Optional[str]) -> float:
    if description and PERIOD_15_RE.search(description):
        return 1.5
    return 1.0


def _normalize_duration(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return value
    if FULL_YEAR_RE.search(value):
        return "Full Year"
    if DURATION_RE.search(value):
        return "One Semester"
    return value


def _normalize_semester_label(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return value
    m = SEMESTER_LABEL_RE.search(value)
    if m:
        return f"Semester {m.group(1)}"
    return value


def _remove_empty_field(obj: Dict[str, Any], key: str) -> None:
    value = obj.get(key)
    if value is None or (isinstance(value, list) and len(value) == 0):
        obj.pop(key, None)


def _choice_name_to_is_online(name: Optional[str]) -> bool:
    if not name:
        return False
    return "online" in name.lower() and "blended" not in name.lower()


# ---------------------------------------------------------------------------
# Offering / choice cleaning
# ---------------------------------------------------------------------------

def _clean_offering(offering: Dict[str, Any]) -> Dict[str, Any]:
    """Return an offering that contains only semester-specific data."""
    cleaned: Dict[str, Any] = {}
    for key in ("courseCode", "semesterLabel", "duration", "gradeLevels", "prerequisites", "notes"):
        if key in offering:
            cleaned[key] = offering[key]

    # Ensure prerequisites are a deduplicated array.
    cleaned["prerequisites"] = _dedupe(_ensure_list(cleaned.get("prerequisites")))

    # Canonicalize scheduling fields.
    cleaned["gradeLevels"] = _sort_grade_levels(cleaned.get("gradeLevels"))
    cleaned["duration"] = _normalize_duration(cleaned.get("duration"))
    cleaned["semesterLabel"] = _normalize_semester_label(cleaned.get("semesterLabel"))

    # Notes on an offering are only kept when they are non-empty.
    _remove_empty_field(cleaned, "notes")

    return cleaned


def _ensure_choice_self_contained(choice: Dict[str, Any], course: Dict[str, Any]) -> Dict[str, Any]:
    """Make a choice self-contained with all required metadata."""
    description = course.get("description")
    choice = copy.deepcopy(choice)

    choice.setdefault("name", "Option")
    choice.setdefault("isOnline", _choice_name_to_is_online(choice.get("name")))
    choice.setdefault("gpaWaiverOption", course.get("gpaWaiverOption", False))

    # Derive creditType from the choice's own offerings or the parent course.
    if choice.get("creditType") is None:
        for o in _ensure_list(choice.get("offerings")):
            if o.get("creditType"):
                choice["creditType"] = o["creditType"]
                break
        if choice.get("creditType") is None and course.get("creditType"):
            choice["creditType"] = course["creditType"]

    # Derive credits from the choice's own offerings, parent course, or description.
    if choice.get("credits") is None:
        for o in _ensure_list(choice.get("offerings")):
            if o.get("credits") is not None:
                choice["credits"] = o["credits"]
                break
        if choice.get("credits") is None and course.get("credits") is not None:
            choice["credits"] = course["credits"]
        if choice.get("credits") is None:
            choice["credits"] = _default_credit(description)

    # Clean every offering inside the choice.
    choice["offerings"] = [
        _clean_offering(o) for o in _ensure_list(choice.get("offerings"))
    ]

    # Remove empty choice notes.
    _remove_empty_field(choice, "notes")

    return choice


def _choices_from_offering_credit_groups(offerings: List[Dict[str, Any]], course: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
    """Split a single-version course into choices if its offerings differ on credit metadata.

    This preserves data that would otherwise be lost when moving creditType/credits from
    offerings up to the course level. If all offerings share the same credit metadata,
    return None so the course stays single-version.
    """
    # Preserve first-seen order of distinct (creditType, credits) combinations.
    groups: List[Tuple[Tuple[Optional[str], Optional[float]], List[Dict[str, Any]]]] = []
    seen: Dict[Tuple[Optional[str], Optional[float]], int] = {}

    for o in offerings:
        key = (o.get("creditType"), o.get("credits"))
        idx = seen.get(key)
        if idx is None:
            seen[key] = len(groups)
            groups.append((key, []))
            idx = len(groups) - 1
        groups[idx][1].append(o)

    if len(groups) <= 1:
        return None

    choices: List[Dict[str, Any]] = []
    for (credit_type, credits), offs in groups:
        name = credit_type or "Option"
        choice = {
            "name": name,
            "isOnline": _choice_name_to_is_online(name),
            "creditType": credit_type,
            "credits": credits,
            "gpaWaiverOption": course.get("gpaWaiverOption", False),
            "offerings": [_clean_offering(copy.deepcopy(o)) for o in offs],
        }
        _remove_empty_field(choice, "notes")
        choices.append(choice)
    return choices


# ---------------------------------------------------------------------------
# Course finalization
# ---------------------------------------------------------------------------

def _choice_from_option(option: Dict[str, Any], shared_offerings: List[Dict[str, Any]], course: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a legacy option dict into a self-contained choice."""
    description = course.get("description")
    name = option.get("creditType") or "Option"
    choice: Dict[str, Any] = {
        "name": name,
        "isOnline": _choice_name_to_is_online(name),
        "creditType": option.get("creditType") or course.get("creditType"),
        "gpaWaiverOption": option.get("gpaWaived", False),
        "offerings": [_clean_offering(copy.deepcopy(o)) for o in shared_offerings],
    }

    # Determine credits without changing the printed value.
    credits = option.get("credits")
    if credits is None:
        for o in shared_offerings:
            if o.get("credits") is not None:
                credits = o["credits"]
                break
    if credits is None and course.get("credits") is not None:
        credits = course["credits"]
    if credits is None:
        credits = _default_credit(description)
    choice["credits"] = credits

    # Remove empty choice notes (options do not carry notes).
    _remove_empty_field(choice, "notes")

    return choice


def _finalize_course(course: Dict[str, Any]) -> Dict[str, Any]:
    """Apply the finalized schema to a single course."""
    description = course.get("description")

    # Gather the legacy/optional fields that may exist on the parent course.
    options = course.pop("options", None)
    existing_choices = course.pop("choices", None) or []
    shared_offerings = course.pop("offerings", None) or []

    # Remove any top-level credit/scheduling fields that belong inside a choice or offering.
    course.pop("isOnline", None)
    course.pop("corequisites", None)

    # Convert legacy options into choices.
    choices: List[Dict[str, Any]] = []
    if options:
        for option in options:
            choices.append(_choice_from_option(option, shared_offerings, course))

    # Preserve any existing choices, making them self-contained.
    for ch in existing_choices:
        choices.append(_ensure_choice_self_contained(ch, course))

    # Deduplicate choices by name, preserving the first occurrence.
    seen_names = set()
    deduped_choices: List[Dict[str, Any]] = []
    for ch in choices:
        name = ch.get("name", "")
        if name in seen_names:
            continue
        seen_names.add(name)
        deduped_choices.append(ch)
    choices = deduped_choices

    # Collapse a single-version course back to the parent.
    collapsed = False
    if len(choices) == 1:
        ch = choices[0]
        course["offerings"] = ch.get("offerings", [])
        course["creditType"] = ch.get("creditType")
        course["credits"] = ch.get("credits")
        course["gpaWaiverOption"] = ch.get("gpaWaiverOption")
        choices = []
        collapsed = True

    if choices:
        # Multi-version: parent holds only shared information.
        course.pop("creditType", None)
        course.pop("credits", None)
        course.pop("gpaWaiverOption", None)
        course.pop("offerings", None)
        course["choices"] = choices
    elif not collapsed:
        # If the same course has offerings with different credit metadata, those
        # represent distinct versions and should be exposed as choices.
        split_choices = _choices_from_offering_credit_groups(shared_offerings, course)
        if split_choices:
            course.pop("creditType", None)
            course.pop("credits", None)
            course.pop("gpaWaiverOption", None)
            course.pop("offerings", None)
            course["choices"] = split_choices
        else:
            # Single-version: parent holds the full scheduling/credit payload.
            credit_type = course.get("creditType")
            credits = course.get("credits")
            cleaned_offerings: List[Dict[str, Any]] = []
            for o in shared_offerings:
                if credit_type is None and o.get("creditType"):
                    credit_type = o["creditType"]
                if credits is None and o.get("credits") is not None:
                    credits = o["credits"]
                cleaned_offerings.append(_clean_offering(o))

            course["offerings"] = cleaned_offerings
            if credit_type is not None:
                course["creditType"] = credit_type
            if credits is not None:
                course["credits"] = credits
            if course.get("credits") is None:
                course["credits"] = _default_credit(description)
            course.setdefault("gpaWaiverOption", False)
            course.pop("choices", None)

    # Final cleanup: remove empty notes arrays everywhere.
    _remove_empty_field(course, "notes")
    for ch in course.get("choices", []):
        _remove_empty_field(ch, "notes")
    for o in course.get("offerings", []):
        _remove_empty_field(o, "notes")

    return course


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_course(course: Dict[str, Any], path: Path, idx: int) -> List[str]:
    """Return a list of schema violations for a single course."""
    errors: List[str] = []
    prefix = f"{path}: course[{idx}] ({course.get('title', '<no title>')})"

    if not course.get("title"):
        errors.append(f"{prefix}: missing title")

    # Forbidden legacy fields
    for forbidden in ("options", "isOnline", "corequisites"):
        if forbidden in course:
            errors.append(f"{prefix}: forbidden field '{forbidden}' at course level")

    has_choices = bool(course.get("choices"))
    has_offerings = bool(course.get("offerings"))

    if has_choices and has_offerings:
        errors.append(f"{prefix}: course has both choices and offerings")

    if has_choices:
        # Parent should not carry per-version metadata.
        for forbidden in ("creditType", "credits", "gpaWaiverOption"):
            if forbidden in course:
                errors.append(f"{prefix}: parent course should not contain '{forbidden}' when choices exist")

        if len(course["choices"]) < 2:
            errors.append(f"{prefix}: single choice should be collapsed to the parent course")

        for ch_idx, ch in enumerate(course["choices"]):
            ch_prefix = f"{prefix}: choice[{ch_idx}] ({ch.get('name', '<no name>')})"
            for required in ("name", "isOnline", "creditType", "credits", "gpaWaiverOption", "offerings"):
                if required not in ch:
                    errors.append(f"{ch_prefix}: missing required field '{required}'")
            if "notes" in ch and not ch["notes"]:
                errors.append(f"{ch_prefix}: empty notes array should be omitted")
            for o_idx, o in enumerate(ch.get("offerings", [])):
                errors.extend(_validate_offering(o, ch_prefix, o_idx))

    elif has_offerings:
        for required in ("creditType", "credits", "gpaWaiverOption"):
            if required not in course:
                errors.append(f"{prefix}: single-version course missing '{required}'")
        if "notes" in course and not course["notes"]:
            errors.append(f"{prefix}: empty notes array should be omitted")
        for o_idx, o in enumerate(course["offerings"]):
            errors.extend(_validate_offering(o, prefix, o_idx))
    else:
        errors.append(f"{prefix}: course has neither choices nor offerings")

    return errors


def _validate_offering(offering: Dict[str, Any], prefix: str, idx: int) -> List[str]:
    errors: List[str] = []
    o_prefix = f"{prefix}: offering[{idx}]"

    for forbidden in ("creditType", "credits", "corequisites"):
        if forbidden in offering:
            errors.append(f"{o_prefix}: forbidden field '{forbidden}'")

    if not isinstance(offering.get("prerequisites"), list):
        errors.append(f"{o_prefix}: 'prerequisites' must be a list")

    grade_levels = offering.get("gradeLevels")
    if not isinstance(grade_levels, list) or grade_levels != sorted(set(grade_levels)):
        errors.append(f"{o_prefix}: 'gradeLevels' must be a sorted list of unique integers")

    if "notes" in offering and not offering["notes"]:
        errors.append(f"{o_prefix}: empty notes array should be omitted")

    return errors


# ---------------------------------------------------------------------------
# I/O and reporting
# ---------------------------------------------------------------------------

def _targets() -> List[Path]:
    paths: List[Path] = []
    for pattern in TARGET_GLOBS:
        paths.extend(PROJECT_ROOT.glob(pattern))
    return sorted(set(paths))


def _process_file(path: Path) -> Tuple[int, int, int, List[str], bool]:
    """Return (course_count, modified_count, total_offerings, errors, written)."""
    original_text = path.read_text(encoding="utf-8")
    data = json.loads(original_text)

    raw_courses = _ensure_list(data.get("courses"))
    modified = 0
    finalized_courses: List[Dict[str, Any]] = []

    for course in raw_courses:
        finalized = _finalize_course(copy.deepcopy(course))
        finalized_courses.append(finalized)
        if json.dumps(finalized, sort_keys=True) != json.dumps(course, sort_keys=True):
            modified += 1

    data["courses"] = finalized_courses

    # Count total offerings across all representations.
    total_offerings = 0
    for c in finalized_courses:
        total_offerings += len(c.get("offerings", []))
        for ch in c.get("choices", []):
            total_offerings += len(ch.get("offerings", []))

    # Validate after transformation before writing so invalid output is never persisted.
    errors: List[str] = []
    for idx, course in enumerate(finalized_courses):
        errors.extend(_validate_course(course, path, idx))

    written = False
    if not errors:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written = True

    return len(finalized_courses), modified, total_offerings, errors, written


def main() -> None:
    targets = _targets()
    if not targets:
        print("No target files found.")
        return

    all_errors: List[str] = []
    total_courses = 0
    total_modified = 0
    total_offerings = 0

    for path in targets:
        course_count, modified, offerings, errors, written = _process_file(path)
        total_courses += course_count
        total_modified += modified
        total_offerings += offerings
        all_errors.extend(errors)
        rel = path.relative_to(PROJECT_ROOT)
        if errors:
            status = "INVALID (not written)"
        elif not written:
            status = "OK (no changes)"
        else:
            status = "OK"
        print(f"{rel}: {course_count} courses, {modified} modified, {offerings} offerings [{status}]")

    print(f"\nTotal: {total_courses} courses, {total_modified} modified, {total_offerings} offerings")

    if all_errors:
        print(f"\nValidation failed with {len(all_errors)} error(s):")
        for err in all_errors:
            print(f"  - {err}")
        raise SystemExit(1)

    print("\nAll target files validated successfully.")


if __name__ == "__main__":
    main()

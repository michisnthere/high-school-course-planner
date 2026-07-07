#!/usr/bin/env python3
"""Normalize extracted academic JSON files to the current schema rules.

Targets:
  - extractor/output/academic-data.json
  - extractor/section_output/*.json
  - extractor/page_output/*.json

Rules applied (from user-provided normalization spec):
  1. Remove unnecessary `choices` arrays; collapse single-choice courses.
  2. Ensure multi-choice courses have complete, self-contained choice objects.
  3. Never store `isOnline` on the parent course.
  4. Drop course notes that merely describe an enrollment option already
     represented by a choice.
  5. `notes` and `prerequisites` are always arrays, never null.
  8. `gradeLevels` are sorted ascending integer arrays.
  9. Remove duplicate prerequisite entries.
 10. Remove the `corequisites` field from every offering.

Credits default to 1.0 unless the course description explicitly mentions
"1.5 period".
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent

TARGET_GLOBS = [
    "extractor/output/academic-data.json",
    "extractor/section_output/*.json",
    "extractor/page_output/*.json",
]

PERIOD_15_RE = re.compile(r"1\.5\s*period", re.IGNORECASE)

DURATION_NORMALIZE_RE = re.compile(r"semester", re.IGNORECASE)
FULL_YEAR_RE = re.compile(r"full\s*year|year\s*long", re.IGNORECASE)
SEMESTER_LABEL_RE = re.compile(r"semester\s*(1|2)", re.IGNORECASE)


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


def _default_credit(credits: Optional[float], description: Optional[str]) -> Optional[float]:
    if credits is not None:
        return credits
    desc = description or ""
    if PERIOD_15_RE.search(desc):
        return 1.5
    return 1.0


def _choice_name_to_is_online(name: Optional[str]) -> bool:
    if not name:
        return False
    return "online" in name.lower() and "blended" not in name.lower()


def _note_is_redundant_with_choices(note: str, choices: List[dict]) -> bool:
    if not note or not choices:
        return False
    note_lower = note.lower()
    choice_names = [str(c.get("name", "")).lower() for c in choices]

    # Generic option descriptions
    if "option listed on page" in note_lower:
        return True
    if "option available" in note_lower:
        return True

    # If the note mentions any choice name, it is redundant
    for name in choice_names:
        if name and name in note_lower:
            return True
    return False


def _normalize_duration(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return value
    if FULL_YEAR_RE.search(value):
        return "Full Year"
    if DURATION_NORMALIZE_RE.search(value):
        return "One Semester"
    return value


def _normalize_semester_label(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return value
    m = SEMESTER_LABEL_RE.search(value)
    if m:
        return f"Semester {m.group(1)}"
    return value


def _normalize_offering(offering: dict, description: Optional[str]) -> dict:
    offering["prerequisites"] = _dedupe(_ensure_list(offering.get("prerequisites")))
    # Rule 10: remove the corequisites field. Non-empty values are rejected in the
    # pre-scan phase, so anything reaching here is safe to discard.
    offering.pop("corequisites", None)
    offering["notes"] = _ensure_list(offering.get("notes"))
    offering["gradeLevels"] = _sort_grade_levels(offering.get("gradeLevels"))
    offering["credits"] = _default_credit(offering.get("credits"), description)
    offering["duration"] = _normalize_duration(offering.get("duration"))
    offering["semesterLabel"] = _normalize_semester_label(offering.get("semesterLabel"))
    return offering


def _fill_choice_from_parent_or_offerings(choice: dict, course: dict) -> dict:
    """Make a choice self-contained with all required fields."""
    description = course.get("description")
    choice.setdefault("isOnline", _choice_name_to_is_online(choice.get("name")))
    choice.setdefault("gpaWaiverOption", course.get("gpaWaiverOption", False))

    # If the choice lacks credit info, look at its own offerings or the parent course.
    if choice.get("creditType") is None:
        for o in _ensure_list(choice.get("offerings")):
            if o.get("creditType"):
                choice["creditType"] = o["creditType"]
                break
        if choice.get("creditType") is None and course.get("creditType"):
            choice["creditType"] = course["creditType"]

    if choice.get("credits") is None:
        for o in _ensure_list(choice.get("offerings")):
            if o.get("credits") is not None:
                choice["credits"] = o["credits"]
                break
        if choice.get("credits") is None:
            choice["credits"] = _default_credit(course.get("credits"), description)

    choice["offerings"] = [_normalize_offering(o, description) for o in _ensure_list(choice.get("offerings"))]
    choice["notes"] = _ensure_list(choice.get("notes"))
    return choice


def _merge_continued_note(stray: dict, previous: dict) -> dict:
    """Merge a stray continuation note into the preceding real course."""
    continued = stray.get("description", "").strip()
    if continued:
        prev_desc = previous.get("description", "")
        if prev_desc:
            previous["description"] = f"{prev_desc} {continued}"
        else:
            previous["description"] = continued
    # If the stray had any notes, carry them forward too.
    previous["notes"] = _ensure_list(previous.get("notes")) + [
        n for n in _ensure_list(stray.get("notes")) if n
    ]
    return previous


def _normalize_course(course: dict) -> dict:
    description = course.get("description")
    choices = course.get("choices")
    if choices is not None and not isinstance(choices, list):
        choices = []

    if choices:
        # Rule 2 / 3: choices must be complete; parent never has isOnline
        course.pop("isOnline", None)
        filled_choices = [_fill_choice_from_parent_or_offerings(c, course) for c in choices]

        # Rule 4: drop course-level notes that merely describe a choice option
        course["notes"] = [
            n for n in _ensure_list(course.get("notes"))
            if not _note_is_redundant_with_choices(n, filled_choices)
        ]

        # Rule 1: collapse if only one choice
        if len(filled_choices) == 1:
            ch = filled_choices[0]
            course["offerings"] = ch.get("offerings", [])
            course["creditType"] = ch.get("creditType")
            course["credits"] = ch.get("credits")
            course["gpaWaiverOption"] = ch.get("gpaWaiverOption")
            # isOnline is intentionally dropped per rule 3
            course.pop("choices", None)
        else:
            course["choices"] = filled_choices
    else:
        # No choices: collapse any single-choice-looking leftover, ensure parent fields
        course.pop("choices", None)
        course.pop("isOnline", None)

        course["offerings"] = [
            _normalize_offering(o, description) for o in _ensure_list(course.get("offerings"))
        ]
        course["notes"] = _ensure_list(course.get("notes"))

        # Ensure course-level creditType/credits/gpaWaiverOption per rule 1
        if course.get("creditType") is None:
            for o in course["offerings"]:
                if o.get("creditType"):
                    course["creditType"] = o["creditType"]
                    break
        if course.get("credits") is None:
            course["credits"] = _default_credit(None, description)
        course.setdefault("gpaWaiverOption", False)

    return course


def _is_stray_continuation(course: dict) -> bool:
    """Detect courses that are continuation notes accidentally extracted as separate courses."""
    title = course.get("title", "").lower()
    return "continued note" in title and not _ensure_list(course.get("offerings")) and not course.get("choices")


def _normalize_record(record: dict) -> dict:
    if "courses" in record:
        raw_courses = _ensure_list(record.get("courses"))
        normalized: List[dict] = []
        for course in raw_courses:
            if _is_stray_continuation(course) and normalized:
                normalized[-1] = _merge_continued_note(course, normalized[-1])
                continue
            normalized.append(_normalize_course(course))
        record["courses"] = normalized
    return record


def _targets() -> List[Path]:
    paths: List[Path] = []
    for pattern in TARGET_GLOBS:
        paths.extend(PROJECT_ROOT.glob(pattern))
    return sorted(set(paths))


def _scan_for_nonempty_corequisites(targets: List[Path]) -> List[str]:
    """Pre-scan to enforce rule 10: stop if any truthy/non-empty corequisites exist."""
    offenders: List[str] = []
    for path in targets:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            offenders.append(f"{path}: could not read ({e})")
            continue
        for c in _ensure_list(data.get("courses")):
            for o in _ensure_list(c.get("offerings")):
                coreq = o.get("corequisites")
                if not (coreq is None or (isinstance(coreq, list) and len(coreq) == 0)):
                    offenders.append(
                        f"{path}: {c.get('title')} offering {o.get('courseCode')} has corequisites {coreq!r}"
                    )
            for ch in _ensure_list(c.get("choices")):
                for o in _ensure_list(ch.get("offerings")):
                    coreq = o.get("corequisites")
                    if not (coreq is None or (isinstance(coreq, list) and len(coreq) == 0)):
                        offenders.append(
                            f"{path}: {c.get('title')} choice {ch.get('name')} "
                            f"offering {o.get('courseCode')} has corequisites {coreq!r}"
                        )
    return offenders


def main() -> None:
    targets = _targets()
    if not targets:
        print("No target files found.")
        return

    offenders = _scan_for_nonempty_corequisites(targets)
    if offenders:
        print("Refusing to normalize: non-empty corequisites detected.")
        for o in offenders:
            print(f"  - {o}")
        raise SystemExit(1)

    for path in targets:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            normalized = _normalize_record(data)
            path.write_text(
                json.dumps(normalized, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            print(f"Normalized {path.relative_to(PROJECT_ROOT)}")
        except Exception as e:
            print(f"ERROR processing {path}: {e}")


if __name__ == "__main__":
    main()

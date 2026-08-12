"""Summer School catalog validation.

Runs BEFORE import.  Validation is strictly report-only: it never deletes,
renames, merges, or "fixes" ambiguous data.  Every problem is returned so a
human can review it before the dry-run import is trusted.

Checks
------
* required fields (title, credits, gradeLevels, sessions/duration availability)
* data types (numeric credits > 0, valid grade levels 9-12, structure of
  prerequisite/corequisite fields, known session/duration tokens)
* duplicates (titles, course codes, duplicate entries across pages) -- REPORTED
  only, never removed
* referential integrity (prerequisite/corequisite titles against known courses,
  graduation requirements against the known requirement list) -- reported as
  warnings, never "corrected"
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Optional, Set

from . import config, schema

VALID_GRADE_LEVELS = {9, 10, 11, 12}


@dataclass
class ValidationProblem:
    kind: str  # e.g. "missing_required", "bad_type", "duplicate", "referential"
    courseKey: str
    field: Optional[str]
    message: str
    severity: str = "error"  # error | warning


@dataclass
class ValidationResult:
    valid: bool
    problems: List[ValidationProblem] = field(default_factory=list)

    @property
    def errors(self) -> List[ValidationProblem]:
        return [p for p in self.problems if p.severity == "error"]

    @property
    def warnings(self) -> List[ValidationProblem]:
        return [p for p in self.problems if p.severity == "warning"]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "problems": [
                {
                    "kind": p.kind,
                    "courseKey": p.courseKey,
                    "field": p.field,
                    "message": p.message,
                    "severity": p.severity,
                }
                for p in self.problems
            ],
        }


def _norm(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _norm_title(value: Optional[str]) -> str:
    import re

    return re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")


VALID_CREDIT_STATUSES = {"credit", "non-credit", "unknown"}


def _validate_credits(course: schema.SummerCourse, key: str, problems: List[ValidationProblem]) -> None:
    """Validate the explicit credit contract used by the DB importer.

    Credit-bearing courses must declare a positive numeric value.  Non-credit
    and unknown courses may omit credits, but must not use a fake zero value.
    """
    status = course.get("creditStatus")
    credits = course.get("credits")
    if status is not None and status not in VALID_CREDIT_STATUSES:
        problems.append(
            ValidationProblem("bad_type", key, "creditStatus", f"unknown creditStatus {status!r}")
        )
        return

    if status in {"non-credit", "unknown"}:
        if credits is not None:
            problems.append(
                ValidationProblem(
                    "bad_type",
                    key,
                    "credits",
                    f"{status} course must use null credits, got {credits!r}",
                )
            )
        return

    if credits is None:
        problems.append(
            ValidationProblem("missing_required", key, "credits", "credits is required")
        )
        return
    if not isinstance(credits, (int, float)) or isinstance(credits, bool):
        problems.append(
            ValidationProblem("bad_type", key, "credits", f"credits must be numeric, got {credits!r}")
        )
        return
    if credits <= 0:
        problems.append(
            ValidationProblem("bad_type", key, "credits", f"credits must be > 0, got {credits}")
        )


def _validate_grade_levels(course: schema.SummerCourse, key: str, problems: List[ValidationProblem]) -> None:
    grades = course.get("gradeLevels")
    if grades is None:
        problems.append(
            ValidationProblem("missing_required", key, "gradeLevels", "gradeLevels is required")
        )
        return
    if not isinstance(grades, list) or not grades:
        problems.append(
            ValidationProblem("bad_type", key, "gradeLevels", "gradeLevels must be a non-empty list")
        )
        return
    for g in grades:
        if not isinstance(g, int) or isinstance(g, bool) or g not in VALID_GRADE_LEVELS:
            problems.append(
                ValidationProblem("bad_type", key, "gradeLevels", f"invalid grade level {g!r}")
            )
            return


def _validate_required_string(
    course: schema.SummerCourse, key: str, field: str, problems: List[ValidationProblem]
) -> None:
    value = course.get(field)
    if not isinstance(value, str) or not value.strip():
        problems.append(ValidationProblem("missing_required", key, field, f"{field} is required"))


def _validate_availability(course: schema.SummerCourse, key: str, problems: List[ValidationProblem]) -> None:
    """Sessions and duration must be present, known, and mutually consistent.

    ``full_summer`` means the course occupies both Summer School sessions, so
    it must list both sessions.  ``one_session`` means the course occupies one
    session; its availability may name one session or both sessions when the
    course is offered as an either-session alternative.
    """
    sessions = course.get("sessions")
    duration = course.get("duration")

    if sessions is None:
        problems.append(
            ValidationProblem("missing_required", key, "sessions", "sessions is required")
        )
    elif not isinstance(sessions, list) or not sessions:
        problems.append(
            ValidationProblem("bad_type", key, "sessions", "sessions must be a non-empty list")
        )
    else:
        for s in sessions:
            if s not in config.SUMMER_SESSIONS:
                problems.append(
                    ValidationProblem("bad_type", key, "sessions", f"unknown session token {s!r}")
                )

    if duration is None:
        problems.append(
            ValidationProblem("missing_required", key, "duration", "duration is required")
        )
    elif duration not in config.SUMMER_DURATIONS:
        problems.append(
            ValidationProblem("bad_type", key, "duration", f"unknown duration {duration!r}")
        )
        return

    # Consistency between sessions and duration.
    if isinstance(sessions, list) and duration in config.SUMMER_DURATIONS:
        if duration == config.DURATION_FULL_SUMMER and set(sessions) != set(config.SUMMER_SESSIONS):
            problems.append(
                ValidationProblem(
                    "bad_type", key, "duration",
                    "full_summer must list both sessions "
                    f"{list(config.SUMMER_SESSIONS)}, got {sessions}",
                )
            )


def _validate_string_list_field(
    course: schema.SummerCourse, key: str, field_name: str, problems: List[ValidationProblem]
) -> None:
    value = course.get(field_name)
    if value is None:
        return
    if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
        problems.append(
            ValidationProblem(
                "bad_type", key, field_name, f"{field_name} must be a list of strings"
            )
        )


def _validate_requirement_list(
    course: schema.SummerCourse, key: str, known_requirements: Set[str], problems: List[ValidationProblem]
) -> None:
    reqs = course.get("fulfillsRequirements")
    if reqs is None:
        return
    if not isinstance(reqs, list) or not all(isinstance(x, str) for x in reqs):
        problems.append(
            ValidationProblem("bad_type", key, "fulfillsRequirements", "must be a list of strings")
        )
        return
    if known_requirements:
        for req in reqs:
            if req not in known_requirements:
                problems.append(
                    ValidationProblem(
                        "referential",
                        key,
                        "fulfillsRequirements",
                        f"references unknown graduation requirement {req!r}",
                        severity="warning",
                    )
                )


def validate_catalog(
    catalog: schema.SummerCatalog,
    *,
    known_requirements: Optional[Set[str]] = None,
    known_course_keys: Optional[Set[str]] = None,
) -> ValidationResult:
    """Validate a combined Summer School catalog.

    ``known_requirements``: canonical graduation requirement names (e.g. from
    section_output/graduation_requirements.json) to check fulfillsRequirements
    against.  ``known_course_keys``: normalized titles/codes of all known
    courses (regular + Summer) to check prerequisites against.
    """
    known_requirements = known_requirements or set()
    known_course_keys = known_course_keys or set()
    problems: List[ValidationProblem] = []

    title_counts: Dict[str, int] = {}
    code_counts: Dict[str, int] = {}
    page_seen: Dict[str, Set[int]] = {}

    for course in catalog.get("courses", []):
        title = (course.get("title") or "").strip()
        key = course.get("key") or _norm_title(title) or "<untitled>"

        # -- Required fields -------------------------------------------------
        if not title:
            problems.append(ValidationProblem("missing_required", key, "title", "title is required"))
        _validate_required_string(course, key, "key", problems)
        if course.get("creditStatus") is None:
            problems.append(ValidationProblem("missing_required", key, "creditStatus", "creditStatus is required"))

        _validate_credits(course, key, problems)
        _validate_grade_levels(course, key, problems)
        _validate_availability(course, key, problems)
        _validate_string_list_field(course, key, "prerequisites", problems)
        _validate_string_list_field(course, key, "corequisites", problems)
        if course.get("courseCode") is not None and not isinstance(course.get("courseCode"), str):
            problems.append(
                ValidationProblem("bad_type", key, "courseCode", "courseCode must be a string")
            )
        if course.get("division") in (None, ""):
            problems.append(
                ValidationProblem(
                    "classification",
                    key,
                    "division",
                    "division is missing or unresolved",
                    severity="warning",
                )
            )
        if course.get("department") in (None, ""):
            problems.append(
                ValidationProblem(
                    "classification",
                    key,
                    "department",
                    "department is missing or unresolved",
                    severity="warning",
                )
            )
        if course.get("regularCourseMatch") is not None:
            match = course.get("regularCourseMatch")
            if not isinstance(match, dict) or match.get("status") not in {"matched", "candidate", "unresolved"}:
                problems.append(
                    ValidationProblem(
                        "bad_type",
                        key,
                        "regularCourseMatch",
                        "regularCourseMatch has invalid shape",
                    )
                )

        _validate_requirement_list(course, key, known_requirements, problems)

        # -- Source reference -------------------------------------------------
        ref = course.get("sourceReference") or {}
        if not isinstance(ref, dict) or not ref.get("file") or not isinstance(ref.get("page"), int):
            problems.append(
                ValidationProblem("missing_required", key, "sourceReference", "sourceReference {file, page} is required")
            )

        # -- Cross-page duplicate tracking -----------------------------------
        norm_title = _norm_title(title)
        if norm_title:
            title_counts[norm_title] = title_counts.get(norm_title, 0) + 1
        code = course.get("courseCode")
        if code:
            code_counts[code] = code_counts.get(code, 0) + 1
        if norm_title:
            page = ref.get("page") if isinstance(ref, dict) else None
            pages = page_seen.setdefault(norm_title, set())
            if page is not None:
                pages.add(page)

        # -- Prerequisite referential check ----------------------------------
        for prereq in course.get("prerequisites", []):
            norm = _norm_title(prereq)
            if known_course_keys and norm and not _matches_known_course(prereq, known_course_keys):
                problems.append(
                    ValidationProblem(
                        "referential",
                        key,
                        "prerequisites",
                        f"prerequisite {prereq!r} does not obviously correspond to a known course",
                        severity="warning",
                    )
                )

        # -- Integrity: preset "isSummerOnly" must be a bool ------------------
        iso = course.get("isSummerOnly")
        if iso is not None and not isinstance(iso, bool):
            problems.append(
                ValidationProblem("bad_type", key, "isSummerOnly", "isSummerOnly must be a boolean")
            )

    # -- Duplicates (reported, never removed) --------------------------------
    seen_titles: Set[str] = set()
    for norm_title, count in title_counts.items():
        if count > 1:
            pages = sorted(page_seen.get(norm_title, set()))
            problems.append(
                ValidationProblem(
                    "duplicate",
                    norm_title,
                    "title",
                    f"duplicate course title {norm_title!r} ({count} entries, pages {pages})",
                    severity="error",
                )
            )
            seen_titles.add(norm_title)

    for code, count in code_counts.items():
        if count > 1:
            problems.append(
                ValidationProblem(
                    "duplicate",
                    f"code:{code}",
                    "courseCode",
                    f"duplicate course code {code!r} ({count} entries)",
                    severity="error",
                )
            )

    return ValidationResult(valid=not [p for p in problems if p.severity == "error"], problems=problems)


def _matches_known_course(prereq: str, known_course_keys: Set[str]) -> bool:
    """Best-effort referential check for a prerequisite string.

    A prerequisite usually names a course title or a course code.  We accept a
    match if the prerequisite (normalized) equals a known course title key,
    contains a known course-code token, or contains a known title key.
    """
    norm = _norm_title(prereq)
    if norm in known_course_keys:
        return True
    for token in norm.split("-"):
        if token and len(token) >= 2 and token in known_course_keys:
            return True
    # Course-code style match (e.g. "MATH211").
    import re

    for code in re.findall(r"[a-z]{2,5}\d{2,3}[a-z]?\d?", norm):
        if code in known_course_keys:
            return True
    return False


# ---------------------------------------------------------------------------
# Helpers to load reference data
# ---------------------------------------------------------------------------

def load_known_requirements() -> Set[str]:
    """Canonical graduation requirement names from the extracted coursebook."""
    from .catalog_matching import load_graduation_requirement_names

    return load_graduation_requirement_names()


def load_known_course_keys() -> Set[str]:
    """Normalized keys of all courses in the regular catalog (for prerequisites)."""
    from .catalog_matching import load_regular_catalog_course_keys

    return load_regular_catalog_course_keys()


def validate_catalog_file(
    path: Optional[str] = None,
    *,
    known_requirements: Optional[Set[str]] = None,
    known_course_keys: Optional[Set[str]] = None,
) -> ValidationResult:
    from .combine import load_catalog

    catalog = load_catalog(path)
    return validate_catalog(catalog, known_requirements=known_requirements, known_course_keys=known_course_keys)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Validate the combined Summer School catalog.")
    parser.add_argument("--catalog", default=None, help="Catalog JSON path.")
    parser.add_argument("--out", default=None, help="Write validation report JSON here.")
    args = parser.parse_args()

    result = validate_catalog_file(args.catalog)
    report_path = args.out or str(config.VALIDATION_REPORT)
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "valid": result.valid,
                "errors": [{
                    "kind": p.kind,
                    "courseKey": p.courseKey,
                    "field": p.field,
                    "message": p.message,
                } for p in result.errors],
                "warnings": [{
                    "kind": p.kind,
                    "courseKey": p.courseKey,
                    "field": p.field,
                    "message": p.message,
                } for p in result.warnings],
            },
            fh,
            indent=2,
            ensure_ascii=False,
        )
    print(json.dumps(result.to_dict(), indent=2))


if __name__ == "__main__":
    main()

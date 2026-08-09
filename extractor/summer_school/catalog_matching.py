"""Matching Summer School courses against the existing regular catalog.

Summer School contains two kinds of courses:
  * courses that clearly correspond to an existing regular catalog course
  * courses that exist ONLY in the Summer School catalog

This module determines candidate matches by title and course code.  Matching is
deliberately conservative:

* exact normalized title  -> ``matched`` (high confidence)
* same course code        -> candidate (medium)
* near-normalized title   -> candidate (medium/low)
* no plausible match      -> ``unresolved`` (treated as Summer-School-only)

Unresolved/candidate matches are REPORTED by the dry-run import, never silently
resolved.  No database writes happen in this module.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Iterator, List, Optional, Set, Tuple

from . import config, schema

_NORM_RE = re.compile(r"[^a-z0-9]+")


def normalize_key(value: Optional[str]) -> str:
    """Normalize a title/code to a stable comparison key."""
    return _NORM_RE.sub("-", (value or "").lower()).strip("-")


def load_regular_catalog() -> Dict[str, Any]:
    """Load the finalized regular academic catalog JSON (no DB)."""
    path = str(config.REGULAR_CATALOG)
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def load_graduation_requirement_names() -> Set[str]:
    """Canonical graduation requirement names for referential validation."""
    names = set()
    source = config.GRADUATION_REQUIREMENTS_SOURCE
    if os.path.exists(source):
        try:
            with open(source, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            for req in data.get("graduationRequirements", []):
                name = (req.get("name") or "").strip()
                if name:
                    names.add(name)
        except Exception:
            pass
    return names or set(config.MEASURABLE_REQUIREMENT_NAMES)


def _iterate_regular_courses(regular: Dict[str, Any]) -> Iterator[Dict[str, Any]]:
    yield from regular.get("courses", [])


def _course_info(course: Dict[str, Any]) -> Tuple[str, Optional[str], Set[str]]:
    """Return (normalized title key, first course code, all codes)."""
    title = course.get("title") or ""
    codes: Set[str] = set()
    offerings = course.get("offerings") or []
    for offering in offerings:
        code = offering.get("courseCode")
        if code:
            codes.add(str(code))
    # Choices can carry their own offerings.
    for choice in course.get("choices") or []:
        for offering in choice.get("offerings") or []:
            code = offering.get("courseCode")
            if code:
                codes.add(str(code))
    return normalize_key(title), (next(iter(codes)) if codes else None), codes


def load_regular_catalog_course_keys() -> Set[str]:
    """Normalized keys of every regular catalog course (for referential checks)."""
    return set(build_regular_index()["titleKey"].keys())


def build_regular_index() -> Dict[str, Any]:
    """Build a lookup index over the regular catalog.

    ``titleKey -> {"title", "codes", "courseId"}`` plus ``codeKey -> titleKey``.
    ``courseId`` is left ``None`` here (no DB access); the dry-run import can
    populate it later when it consults the actual database.
    """
    regular = load_regular_catalog()
    index: Dict[str, Any] = {
        "titleKey": {},
        "codeKey": {},
    }
    for course in _iterate_regular_courses(regular):
        title_key, default_code, codes = _course_info(course)
        if not title_key:
            continue
        index["titleKey"][title_key] = {
            "title": course.get("title"),
            "codes": sorted(codes),
            "courseId": None,
        }
        for code in codes:
            index["codeKey"].setdefault(normalize_key(code), title_key)
    return index


def match_course(course: schema.SummerCourse, index: Dict[str, Any]) -> schema.SummerCourseMatch:
    """Determine the relationship between one Summer course and the regular catalog."""
    title = course.get("title") or ""
    title_key = normalize_key(title)
    code = course.get("courseCode")

    title_hit = index["titleKey"].get(title_key)

    if title_hit is not None:
        return {
            "status": "matched",
            "matchedTitle": title_hit.get("title"),
            "matchedCourseCode": (course.get("courseCode") or (title_hit.get("codes") or [None])[0]),
            "confidence": "high",
            "reason": "normalized title matches a regular catalog course",
        }

    # Code-based candidate.
    if code:
        code_key = normalize_key(code)
        linked_title_key = index["codeKey"].get(code_key)
        if linked_title_key:
            hit = index["titleKey"].get(linked_title_key)
            return {
                "status": "candidate",
                "matchedTitle": hit.get("title"),
                "matchedCourseCode": code,
                "confidence": "medium",
                "reason": f"course code {code!r} matches a regular course offering",
            }

    # Near-title candidates (token overlap) -- conservative, reported only.
    candidate = _near_title_candidate(title_key, index["titleKey"])
    if candidate is not None:
        return {
            "status": "candidate",
            "matchedTitle": candidate,
            "matchedCourseCode": None,
            "confidence": "low",
            "reason": "title is similar but not identical to a regular catalog course",
        }

    return {
        "status": "unresolved",
        "matchedTitle": None,
        "matchedCourseCode": code or None,
        "confidence": None,
        "reason": "no confident match found in the regular catalog",
    }


def _near_title_candidate(title_key: str, title_index: Dict[str, Any]) -> Optional[str]:
    """Return a single similar title key or None.

    Uses exact token matching: every token in the Summer course title must also
    appear somewhere in the candidate's title, and the candidate must not be a
    generic word of length < 3.
    """
    tokens = [t for t in title_key.split("-") if len(t) >= 3]
    if not tokens:
        return None

    def _score(candidate: str) -> int:
        candidate_tokens = set(candidate.split("-"))
        return sum(1 for t in tokens if t in candidate_tokens)

    best_key: Optional[str] = None
    best_score = 0
    for candidate, info in title_index.items():
        score = _score(candidate)
        if score > best_score:
            best_score = score
            best_key = candidate
    if best_key is not None and best_score == len(tokens):
        return best_key
    return None


def annotate_catalog(
    catalog: schema.SummerCatalog,
    index: Optional[Dict[str, Any]] = None,
) -> schema.SummerCatalog:
    """Attach isSummerOnly + regularCourseMatch to every course (in place).

    Returns the same catalog object updated with match annotations so the
    combined catalog can be saved as the "ready" catalog that dry-run consumes.
    """
    index = index if index is not None else build_regular_index()
    for course in catalog.get("courses", []):
        match = match_course(course, index)
        course["regularCourseMatch"] = match
        course["isSummerOnly"] = match["status"] == "unresolved"
    return catalog


def analyze_matches(
    catalog: schema.SummerCatalog,
    index: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Summarize the match distribution across a catalog."""
    index = index if index is not None else build_regular_index()
    summary: Dict[str, Any] = {"matched": [], "candidate": [], "unresolved": []}
    for course in catalog.get("courses", []):
        match = match_course(course, index)
        record = {
            "title": course.get("title"),
            "sourceReference": course.get("sourceReference"),
            "match": match,
        }
        summary.setdefault(match["status"], []).append(record)
    return summary


if __name__ == "__main__":
    from .combine import load_catalog

    catalog = load_catalog()
    annotated = annotate_catalog(catalog)
    summary = analyze_matches(annotated)
    print(
        json.dumps(
            {
                "matched": len(summary["matched"]),
                "candidate": len(summary["candidate"]),
                "unresolved": len(summary["unresolved"]),
            },
            indent=2,
        )
    )
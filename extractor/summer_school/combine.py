"""Combine per-page Summer School extraction results into a single catalog.

Combining keeps page order and performs only mechanical normalization:
stable keys, source references, list fields, credit status, and conflict
warnings. It does not infer course facts or silently overwrite duplicates.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import config, schema


def normalize_course_key(title: str, course_code: Optional[str] = None) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (title or "").lower()).strip("-")
    code = re.sub(r"[^a-z0-9]+", "-", (course_code or "").lower()).strip("-")
    return "-".join(part for part in (base, code) if part) or "untitled"


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _normalize_course(
    raw_course: Dict[str, Any],
    *,
    source_file: str,
    page: Optional[int],
) -> schema.SummerCourse:
    course = dict(raw_course)
    title = str(course.get("title") or "").strip()
    code = course.get("courseCode")
    course["title"] = title
    course["key"] = course.get("key") or normalize_course_key(title, str(code or ""))
    course["sourceReference"] = course.get("sourceReference") or {
        "file": source_file,
        "page": page,
    }
    for field in (
        "prerequisites",
        "corequisites",
        "fulfillsRequirements",
        "attributes",
        "notes",
        "extractionIssues",
        "sessions",
    ):
        course[field] = _as_list(course.get(field))
    if "credits" not in course:
        course["credits"] = None
    if "creditStatus" not in course:
        course["creditStatus"] = "credit" if course.get("credits") is not None else "unknown"
    return course


def _conflict_warnings(courses: List[schema.SummerCourse]) -> List[str]:
    warnings: List[str] = []
    by_key: Dict[str, List[schema.SummerCourse]] = {}
    for course in courses:
        by_key.setdefault(str(course.get("key") or ""), []).append(course)
    checked_fields = (
        "title",
        "courseCode",
        "credits",
        "creditStatus",
        "gradeLevels",
        "sessions",
        "duration",
        "prerequisites",
        "fulfillsRequirements",
    )
    for key, items in by_key.items():
        if key and len(items) > 1:
            pages = [c.get("sourceReference", {}).get("page") for c in items]
            warnings.append(f"duplicate key {key!r} appears on pages {pages}")
            for field in checked_fields:
                values = {json.dumps(c.get(field), sort_keys=True) for c in items}
                if len(values) > 1:
                    warnings.append(f"conflict for key {key!r} field {field!r} on pages {pages}")
    return warnings


def combine(
    page_results: List[Dict[str, Any]],
    *,
    source_file: Optional[str] = None,
    out_path: Optional[str] = None,
) -> schema.SummerCatalog:
    """Combine page results (in page order) into one Summer School catalog."""
    source_file = source_file or config.SOURCE_PDF_NAME
    courses: List[schema.SummerCourse] = []
    warnings: List[str] = []

    for page_result in page_results:
        ref = page_result.get("sourceReference") or {}
        page = ref.get("page") if isinstance(ref, dict) else None

        for course in page_result.get("courses", []):
            courses.append(_normalize_course(course, source_file=source_file, page=page))

        for warning in page_result.get("warnings", []):
            warnings.append(str(warning))

    warnings.extend(_conflict_warnings(courses))

    catalog: schema.SummerCatalog = {
        "schemaVersion": "summer-school-catalog/v1",
        "source": {"file": source_file, "page": 1},
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "courses": courses,
        "warnings": warnings,
    }

    if out_path:
        write_catalog(catalog, out_path)
    return catalog


def write_catalog(catalog: schema.SummerCatalog, out_path: Optional[str] = None) -> str:
    """Persist a catalog to JSON (default: combined/summer-school-catalog.json)."""
    out_path = out_path or str(config.COMBINED_CATALOG)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(catalog, fh, indent=2, ensure_ascii=False)
    return out_path


def load_catalog(path: Optional[str] = None) -> schema.SummerCatalog:
    """Load a Summer School catalog JSON file."""
    path = path or str(config.COMBINED_CATALOG)
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def combine_from_disk(
    extract_dir: Optional[str] = None,
    *,
    out_path: Optional[str] = None,
) -> schema.SummerCatalog:
    """Load per-page JSON from disk (in page order) and combine them."""
    from .extract_page import load_page_results

    page_results = load_page_results(extract_dir)
    return combine(page_results, out_path=out_path)


if __name__ == "__main__":
    catalog = combine_from_disk()
    print(
        json.dumps(
            {
                "courses": len(catalog["courses"]),
                "warnings": len(catalog["warnings"]),
                "writtenTo": str(config.COMBINED_CATALOG),
            },
            indent=2,
        )
    )

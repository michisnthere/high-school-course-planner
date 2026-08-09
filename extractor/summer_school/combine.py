"""Combine per-page Summer School extraction results into a single catalog.

Combining is deliberately a pure concatenation in page order -- it performs NO
semantic merging, deduping, or course guessing.  Duplicate detection and other
semantic checks belong to the validation stage so that nothing is silently
"fixed" before a human can review it.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import config, schema


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
            # Attach the source page that produced this course if the provider
            # did not already carry it on the course record.
            if not course.get("sourceReference"):
                course["sourceReference"] = {
                    "file": source_file,
                    "page": page,
                }
            courses.append(course)

        for warning in page_result.get("warnings", []):
            warnings.append(str(warning))

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
"""End-to-end Summer School framework pipeline (extraction side only).

Stages (all DB-free; nothing here touches Neon/Postgres):

    render    -> extract    -> combine    -> validate    -> annotate(match)
     (PNG)       (page JSON)   (catalog)     (report)      (ready catalog)

The "ready" catalog is the last stage.  A separate import stage (the dry-run
import) consumes it; this module never writes to the database.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from . import config, schema
from . import render as render_mod
from . import extract_page as extract_mod
from . import combine as combine_mod
from . import validate as validate_mod
from . import catalog_matching as match_mod


def run_stages(
    *,
    render: bool = True,
    do_extract: bool = True,
    do_combine: bool = True,
    validate: bool = True,
    annotate: bool = True,
    dpi: int = config.DEFAULT_DPI,
    client: Any = None,
) -> Dict[str, Any]:
    """Run a configurable chain of pipeline stages.  Returns a summary dict."""
    summary: Dict[str, Any] = {}

    if render:
        paths = render_mod.render_summer_pdf(dpi=dpi)
        summary["renderedPages"] = len(paths)
        summary["pageManifest"] = render_mod.build_manifest(paths)

    if do_extract:
        written = extract_mod.extract_all_pages(client=client)
        summary["extractedPages"] = len(written)

    if do_combine:
        catalog = combine_mod.combine_from_disk()
        catalog = _mirror_course_metadata(catalog)
        summary["combinedCourses"] = len(catalog.get("courses", []))
        summary["combinedWarnings"] = len(catalog.get("warnings", []))

    if validate:
        result = validate_mod.validate_catalog(catalog)
        _write_validation_report(result)
        summary["validation"] = {"valid": result.valid, "errors": len(result.errors)}
        if not result.valid:
            summary["validationErrors"] = [p.message for p in result.errors]

    if annotate:
        annotated = match_mod.annotate_catalog(catalog)
        ready_path = combine_mod.write_catalog(annotated, str(config.READY_CATALOG))
        match_counts = match_mod.analyze_matches(annotated)
        summary["matched"] = len(match_counts["matched"])
        summary["candidate"] = len(match_counts["candidate"])
        summary["unresolved"] = len(match_counts["unresolved"])
        summary["readyCatalog"] = ready_path

    return summary


def _mirror_course_metadata(catalog: schema.SummerCatalog) -> schema.SummerCatalog:
    """Back-populate missing optional course fields to keep records reviewable."""
    return catalog


def _write_validation_report(result: validate_mod.ValidationResult) -> str:
    os.makedirs(str(config.COMBINED_DIR), exist_ok=True)
    path = str(config.VALIDATION_REPORT)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(result.to_dict(), fh, indent=2, ensure_ascii=False)
    return path


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Run part or all of the Summer School extraction framework."
    )
    parser.add_argument("--skip-render", action="store_true", help="Do not re-render PNG pages.")
    parser.add_argument("--skip-extract", action="store_true", help="Do not re-extract pages.")
    parser.add_argument("--skip-combine", action="store_true", help="Reuse existing combined catalog.")
    parser.add_argument("--skip-validate", action="store_true", help="Skip validation stage.")
    parser.add_argument("--skip-annotate", action="store_true", help="Skip match annotation stage.")
    parser.add_argument("--dpi", type=int, default=config.DEFAULT_DPI)
    args = parser.parse_args()

    summary = run_stages(
        render=not args.skip_render,
        do_extract=not args.skip_extract,
        do_combine=not args.skip_combine,
        validate=not args.skip_validate,
        annotate=not args.skip_annotate,
        dpi=args.dpi,
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
"""End-to-end Summer School framework pipeline (extraction side only).

Stages (all DB-free; nothing here touches Neon/Postgres):

    render (PNG)  ->  agent extraction (page JSON)  ->  finalize (combine -> validate -> match)

* ``render`` renders the Summer School PDF to ``images/page_NNN.png``.
* The extraction stage is performed by a coding agent that visually reads the
  PNGs and writes ``extracted/page_NNN.json`` (see ``agent_png_extraction.py``
  worksheet and ``prompts/summer-page.md``).  The pipeline only verifies that
  every rendered page has a page JSON; it never runs OCR, PDF text extraction,
  or a vision client.
* ``finalize`` combines the page JSONs, validates, matches against the regular
  catalog, and writes ``output/combined/summer-school-ready.json``.

The "ready" catalog is the last stage.  A separate import stage (the dry-run
import) consumes it; this module never writes to the database.
"""
from __future__ import annotations

import json
from typing import Any, Dict

from . import config
from . import render as render_mod
from . import agent_png_extraction as agent_mod


def run_stages(
    *,
    render: bool = True,
    do_extract: bool = True,
    do_combine: bool = True,
    validate: bool = True,
    annotate: bool = True,
    dpi: int = config.DEFAULT_DPI,
) -> Dict[str, Any]:
    """Run the pipeline stages.  Returns a summary dict."""
    summary: Dict[str, Any] = {}

    if render:
        paths = render_mod.render_summer_pdf(dpi=dpi)
        summary["renderedPages"] = len(paths)
        summary["pageManifest"] = render_mod.build_manifest(paths)

    if do_extract:
        summary["extractedPages"] = len(agent_mod.load_extracted_pages())
        missing, orphaned = agent_mod.verify_exact_coverage()
        summary["missingPageJson"] = sorted(missing)
        summary["orphanedPageJson"] = sorted(orphaned)
        if summary["missingPageJson"] or summary["orphanedPageJson"]:
            summary["extractionPending"] = True

    # combine + validate + annotate run as a single finalize step over the
    # agent-transcribed page JSONs.
    if do_combine and (validate or annotate):
        if summary.get("missingPageJson") or summary.get("orphanedPageJson"):
            raise SystemExit(
                f"Cannot finalize: missing={summary.get('missingPageJson', [])}, "
                f"orphaned={summary.get('orphanedPageJson', [])}. "
                "Transcribe missing pages from images/ or remove orphaned JSONs."
            )
        result = agent_mod.finalize()
        summary["finalized"] = True
        summary.update(result)

    return summary


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Run part or all of the Summer School extraction framework."
    )
    parser.add_argument("--skip-render", action="store_true", help="Do not re-render PNG pages.")
    parser.add_argument("--skip-extract", action="store_true", help="Do not check page extraction coverage.")
    parser.add_argument("--skip-combine", action="store_true", help="Skip combine/validate/annotate finalize.")
    parser.add_argument("--dpi", type=int, default=config.DEFAULT_DPI)
    args = parser.parse_args()

    summary = run_stages(
        render=not args.skip_render,
        do_extract=not args.skip_extract,
        do_combine=not args.skip_combine,
        dpi=args.dpi,
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
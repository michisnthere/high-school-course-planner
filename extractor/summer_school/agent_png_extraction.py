"""Reusable agent-driven Summer School extraction workflow (PNGs -> page JSON).

The rendered page **PNGs are the source of truth**. A coding agent (this
workflow's human-in-the-loop) visually reads each PNG and transcribes the course
listings into one JSON per page. Nothing in this package consumes OCR, the PDF
text layer, a vision client, or any previously published Summer School JSON.

Reusable workflow (a future agent reruns it against a changed PDF):

    1. Render the PDF to PNGs (automated):
           python -m extractor.summer_school.render
       PNGs are written to extractor/summer_school/images/ (page_001.png ...).

    2. See what the agent needs to transcribe:
           python -m extractor.summer_school.agent_png_extraction worksheet

    3. Agent reads each PNG (Read tool) and writes one page JSON:
           python -m extractor.summer_school.agent_png_extraction page <N>
       or saves extractor/summer_school/extracted/page_NNN.json directly.
       Follow the contract in extractor/summer_school/prompts/summer-page.md.

    4. Finalize (automated: combine -> validate -> match -> ready catalog):
           python -m extractor.summer_school.agent_png_extraction finalize

No hard-coded course facts live in this module on purpose: the transcription
must come from inspecting images/page_*.png, never copied from prior JSON.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import catalog_matching, combine as combine_mod, config, render as render_mod
from . import validate as validate_mod
from .extract_page import load_page_results, write_page_json as _write_page_json

PACKAGE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = config.IMAGES_DIR
EXTRACTED_DIR = config.EXTRACTED_DIR
PROMPT_PATH = PACKAGE_DIR / "prompts" / "summer-page.md"

EXTRACTION_METHOD = "agent_read_rendered_pngs_directly"


# ---------------------------------------------------------------------------
# Page inventory
# ---------------------------------------------------------------------------


def page_number_from_image(path: Path) -> int:
    """Parse the deterministic page_NNN.png filename into its page number."""
    match = re.fullmatch(r"page_(\d{3})\.png", path.name)
    if not match:
        raise ValueError(f"Unrecognized page image filename: {path.name}")
    return int(match.group(1))


def manifest_pages(image_dir: Optional[Path] = None) -> List[Path]:
    """Return rendered page PNG paths in strict ascending page order."""
    image_dir = Path(image_dir or IMAGES_DIR)
    if not image_dir.is_dir():
        raise FileNotFoundError(f"No rendered pages directory at {image_dir}")
    pages = [p for p in image_dir.glob("page_*.png") if re.fullmatch(r"page_\d{3}\.png", p.name)]
    pages.sort(key=page_number_from_image)
    return pages


def render_pages(dpi: int = config.DEFAULT_DPI) -> List[Path]:
    """Automated stage 1: render the Summer School PDF to images/."""
    paths = render_mod.render_summer_pdf(dpi=dpi)
    return [Path(p) for p in paths]


# ---------------------------------------------------------------------------
# Page-level persistence (the transcription the agent writes)
# ---------------------------------------------------------------------------


def write_page_json(
    page_number: int,
    courses: List[Dict[str, Any]],
    warnings: Optional[List[str]] = None,
    image_dir: Optional[Path] = None,
    extracted_dir: Optional[Path] = None,
) -> str:
    """Persist one agent-transcribed page as extracted/page_NNN.json."""
    image_dir = Path(image_dir or IMAGES_DIR)
    extracted_dir = Path(extracted_dir or EXTRACTED_DIR)
    page_result: Dict[str, Any] = {
        "sourceReference": {"file": config.SOURCE_PDF_NAME, "page": page_number},
        "sourcePage": page_number,
        "sourceImage": str(image_dir / f"page_{page_number:03d}.png"),
        "courses": courses,
        "warnings": warnings or (["page contains no course listings"] if not courses else []),
    }
    return _write_page_json(page_number, page_result, out_dir=str(extracted_dir))


def load_extracted_pages(extracted_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Load extracted/*.json back in page order."""
    return load_page_results(out_dir=str(Path(extracted_dir or EXTRACTED_DIR)))


def verify_coverage(
    image_dir: Optional[Path] = None,
    extracted_dir: Optional[Path] = None,
) -> List[int]:
    """Return the page numbers whose PNG has no extracted page JSON yet."""
    images = manifest_pages(image_dir)
    existing = _extracted_page_numbers(extracted_dir)
    return [page_number_from_image(p) for p in images if page_number_from_image(p) not in existing]


def verify_exact_coverage(
    image_dir: Optional[Path] = None,
    extracted_dir: Optional[Path] = None,
) -> tuple:
    """Verify the extracted page-number set exactly equals the PNG page-number set.

    Returns (missing, orphaned) where:
      - missing: page numbers with a PNG but no extracted JSON
      - orphaned: page numbers with an extracted JSON but no PNG

    Both lists are sorted.  An empty pair means the sets match exactly.
    """
    images = manifest_pages(image_dir)
    png_numbers = {page_number_from_image(p) for p in images}
    json_numbers = _extracted_page_numbers(extracted_dir)
    missing = sorted(png_numbers - json_numbers)
    orphaned = sorted(json_numbers - png_numbers)
    return missing, orphaned


def _extracted_page_number_of(page_result: Dict[str, Any]) -> int:
    ref = page_result.get("sourceReference") or {}
    return int(ref.get("page") or 0)


def _extracted_page_numbers(extracted_dir: Optional[Path] = None) -> set:
    names = set()
    for name in os.listdir(Path(extracted_dir or EXTRACTED_DIR)):
        match = re.fullmatch(r"page_(\d{3})\.json", name)
        if match:
            names.add(int(match.group(1)))
    return names


# ---------------------------------------------------------------------------
# The extraction contract shown to the agent
# ---------------------------------------------------------------------------


def worksheet_text() -> str:
    """Describe the exact transcription task, page by page, for the agent."""
    images = manifest_pages()
    missing = verify_coverage()
    prompt = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else "(prompt file missing)"
    lines: List[str] = [
        "Summer School extraction: PNGs are the source of truth.",
        "",
        "Step 1 (automated, already done): render SummerSchool2627.pdf -> images/.",
        f"    {len(images)} page images currently exist.",
        "",
        "Step 2 (agent): inspect EACH page image below with your Read tool and",
        "transcribe it to JSON following the contract in:",
        f"    {PROMPT_PATH}",
        "Persist one JSON per page as extracted/page_NNN.json (courses=[] for",
        "pages with no course listings).",
        "",
        "Step 3 (automated): after every page has a JSON, run",
        "    python -m extractor.summer_school.agent_png_extraction finalize",
        "",
    ]
    for path in images:
        number = page_number_from_image(path)
        lines.append(f"    page {number:>2}  image={path.name}  -> extracted/page_{number:03d}.json")
    if missing:
        lines.append("")
        lines.append(f"MISSING page JSONs to transcribe: {sorted(missing)}")
    else:
        lines.append("")
        lines.append("Every page image already has an extracted page JSON.")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Finalize: combine + validate + match (fully automated)
# ---------------------------------------------------------------------------


def finalize(
    extracted_dir: Optional[Path] = None,
    image_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Combine the page JSONs, validate, match, and write the ready catalog."""
    extracted_dir = Path(extracted_dir or EXTRACTED_DIR)
    image_dir = Path(image_dir or IMAGES_DIR)
    missing, orphaned = verify_exact_coverage(image_dir=image_dir, extracted_dir=extracted_dir)
    errors: List[str] = []
    if missing:
        errors.append(
            f"Missing extracted JSONs for pages {missing}. "
            "Transcribe them first (see worksheet)."
        )
    if orphaned:
        errors.append(
            f"Orphaned extracted JSONs for pages {orphaned} have no corresponding PNG. "
            "Remove them or re-render the PDF."
        )
    if errors:
        raise SystemExit(
            "Refusing to finalize:\n  " + "\n  ".join(errors)
        )

    catalog = combine_mod.combine_from_disk(extract_dir=str(extracted_dir))
    catalog["extractionMethod"] = EXTRACTION_METHOD
    catalog["sourceImages"] = str(IMAGES_DIR)

    annotated = catalog_matching.annotate_catalog(catalog)
    combined_path = combine_mod.write_catalog(annotated, str(config.COMBINED_CATALOG))
    ready_path = combine_mod.write_catalog(annotated, str(config.READY_CATALOG))

    result = validate_mod.validate_catalog(annotated, known_requirements=validate_mod.load_known_requirements())
    Path(config.VALIDATION_REPORT).write_text(
        json.dumps(result.to_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    matches = catalog_matching.analyze_matches(annotated)
    return {
        "pages": len(manifest_pages()),
        "extractedPages": len(load_extracted_pages(extracted_dir)),
        "courses": len(annotated.get("courses", [])),
        "matched": len(matches.get("matched", [])),
        "candidate": len(matches.get("candidate", [])),
        "unresolved": len(matches.get("unresolved", [])),
        "validationValid": result.valid,
        "validationErrors": len(result.errors),
        "validationWarnings": len(result.warnings),
        "combinedCatalog": str(combined_path),
        "readyCatalog": str(ready_path),
        "validationReport": str(config.VALIDATION_REPORT),
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: Optional[List[str]] = None) -> None:
    args = list(argv if argv is not None else sys.argv[1:])
    if not args or args[0] == "--help" or args[0] in ("-h",):
        print(__doc__)
        print("Subcommands:")
        print("  render      Render the Summer School PDF to images/ (stage 1).")
        print("  worksheet   Print the per-page transcription task for the agent.")
        print("  page <N>    Scaffold extracted/page_NNN.json with empty courses.")
        print("  status      Show PNG vs extracted-page coverage.")
        print("  finalize    Combine + validate + match -> output/combined/*.")
        return

    command = args[0]
    if command == "render":
        paths = render_pages()
        print(json.dumps({"rendered": len(paths), "imagesDir": str(IMAGES_DIR)}, indent=2))
    elif command == "worksheet":
        print(worksheet_text())
    elif command == "page":
        if len(args) < 2:
            raise SystemExit("usage: ... page <N>")
        page = int(args[1])
        path = write_page_json(page, [])
        print(json.dumps({"page": page, "writtenTo": path}, indent=2))
    elif command == "status":
        missing, orphaned = verify_exact_coverage()
        print(
            json.dumps(
                {
                    "images": len(manifest_pages()),
                    "extractedPages": len(load_extracted_pages()),
                    "missingPageJson": sorted(missing),
                    "orphanedPageJson": sorted(orphaned),
                },
                indent=2,
            )
        )
    elif command == "finalize":
        print(json.dumps(finalize(), indent=2))
    else:
        raise SystemExit(f"Unknown command: {command!r}. See --help.")


if __name__ == "__main__":
    main()
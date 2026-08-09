"""Extract structured JSON from one rendered Summer School PNG page.

The visual extraction itself is delegated to the vision client; this module
owns the *framework* around it: deterministic inputs, per-page JSON persistence
(``page_NNN.json`` under the extract output directory in page order), and
enforcement that every extracted course carries its source page.
"""
from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List, Optional

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from . import config, schema  # noqa: E402
from .vision_client import get_summer_client  # noqa: E402


def _page_number_from_path(path: str) -> int:
    stem = os.path.basename(path)
    # page_007.png -> 7
    if stem.startswith("page_") and stem.endswith(".png"):
        return int(stem[len("page_") : -len(".png")])
    raise ValueError(f"Unrecognized page image filename: {path}")


def extract_page(
    image_path: str,
    client: Any = None,
    *,
    page_number: Optional[int] = None,
) -> schema.PageExtractionResult:
    """Extract one PNG page into a structured page result."""
    page_number = page_number if page_number is not None else _page_number_from_path(image_path)
    client = client or get_summer_client()

    result = client.extract_page(image_path, page_number)

    # Normalize to the documented page-result shape, preserving provenance.
    page_result: schema.PageExtractionResult = {
        "sourceReference": {
            "file": result.get("sourceReference", {}).get("file", config.SOURCE_PDF_NAME),
            "page": result.get("sourceReference", {}).get("page", page_number),
        },
        "courses": result.get("courses", []),
        "warnings": result.get("warnings", []),
    }

    return page_result


def write_page_json(
    page_number: int,
    page_result: schema.PageExtractionResult,
    out_dir: Optional[str] = None,
) -> str:
    """Persist one page result as extract/page_NNN.json."""
    out_dir = out_dir or str(config.EXTRACT_DIR)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"page_{page_number:03d}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(page_result, fh, indent=2, ensure_ascii=False)
    return path


def extract_all_pages(
    image_paths: Optional[List[str]] = None,
    client: Any = None,
    *,
    out_dir: Optional[str] = None,
) -> List[str]:
    """Run extraction over every rendered page, preserving page order.

    Returns the list of written per-page JSON paths in page order.
    """
    from .render import verify_page_order

    image_paths = image_paths if image_paths is not None else verify_page_order()
    written: List[str] = []
    for image_path in image_paths:
        page_number = _page_number_from_path(image_path)
        page_result = extract_page(image_path, client, page_number=page_number)
        written.append(write_page_json(page_number, page_result, out_dir=out_dir))
    return written


def load_page_results(out_dir: Optional[str] = None) -> List[Dict[str, Any]]:
    """Load extract/*.json back in page order."""
    out_dir = out_dir or str(config.EXTRACT_DIR)
    if not os.path.isdir(out_dir):
        return []
    pages: List[Dict[str, Any]] = []
    for name in os.listdir(out_dir):
        if not name.startswith("page_") or not name.endswith(".json"):
            continue
        stem = name[len("page_") : -len(".json")]
        if not stem.isdigit():
            continue
        with open(os.path.join(out_dir, name), "r", encoding="utf-8") as fh:
            pages.append((int(stem), json.load(fh)))
    pages.sort(key=lambda pair: pair[0])
    return [data for _, data in pages]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Extract Summer School pages to per-page JSON.")
    parser.add_argument("--out", default=None, help="Extract output directory.")
    args = parser.parse_args()
    paths = extract_all_pages(out_dir=args.out)
    print(f"Extracted {len(paths)} pages.")
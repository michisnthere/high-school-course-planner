"""Framework helpers for per-page Summer School extraction persistence.

The visual transcription itself is done by a coding agent that reads the
rendered page PNGs directly (see ``agent_png_extraction.py`` and
``prompts/summer-page.md``).  This module owns the deterministic framework
around it: page-number parsing, per-page JSON persistence
(``page_NNN.json`` under the extracted directory in page order), and loading
page results back in page order.  No OCR, PDF text layer, or vision client is
involved anywhere in this flow.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

from . import config, schema  # noqa: E402


def _page_number_from_path(path: str) -> int:
    stem = os.path.basename(path)
    # page_007.png -> 7
    if stem.startswith("page_") and stem.endswith(".png"):
        return int(stem[len("page_") : -len(".png")])
    raise ValueError(f"Unrecognized page image filename: {path}")


def write_page_json(
    page_number: int,
    page_result: schema.PageExtractionResult,
    out_dir: Optional[str] = None,
) -> str:
    """Persist one page result as extracted/page_NNN.json."""
    out_dir = out_dir or str(config.EXTRACT_DIR)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"page_{page_number:03d}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(page_result, fh, indent=2, ensure_ascii=False)
    return path


def load_page_results(out_dir: Optional[str] = None) -> List[Dict[str, Any]]:
    """Load extracted/*.json back in page order."""
    out_dir = out_dir or str(config.EXTRACT_DIR)
    if not os.path.isdir(out_dir):
        return []
    pages: List[Dict[str, Any]] = []
    for name in os.listdir(out_dir):
        if not re.fullmatch(r"page_\d{3}\.json", name):
            continue
        stem = name[len("page_") : -len(".json")]
        with open(os.path.join(out_dir, name), "r", encoding="utf-8") as fh:
            pages.append((int(stem), json.load(fh)))
    pages.sort(key=lambda pair: pair[0])
    return [data for _, data in pages]
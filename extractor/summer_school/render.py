"""PDF -> PNG rendering for the Summer School coursebook.

Reuses the existing ``extractor/page_renderer.render_pdf_to_pngs`` (PyMuPDF)
so the regular-course pipeline remains the single source of rendering logic.
This module adds Summer School-specific conveniences:

* deterministic, page-numbered filenames (page_001.png, page_002.png, ...)
* preserved page order
* a manifest describing exactly which pages were rendered and where
"""
from __future__ import annotations

import os
import sys
from typing import Any, Dict, List, Optional

# Reuse the shared page_renderer (extractor/page_renderer.py).  Supports both
# package-relative import (`python -m extractor.summer_school.render`) and
# direct script execution (`python extractor/summer_school/render.py`).
try:
    from ..page_renderer import render_pdf_to_pngs  # type: ignore
except ImportError:  # direct-script execution: add extractor/ to sys.path
    if __package__ in (None, ""):
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from page_renderer import render_pdf_to_pngs  # type: ignore  # noqa: E402

from . import config  # noqa: E402


def render_summer_pdf(
    pdf_path: Optional[str] = None,
    out_dir: Optional[str] = None,
    dpi: int = config.DEFAULT_DPI,
) -> List[str]:
    """Render every page of the Summer School PDF to a deterministic PNG set.

    Returns the page image paths in page order (page_001.png first).  Raises
    if the PDF cannot be opened or has no pages.
    """
    pdf_path = pdf_path or str(config.SOURCE_PDF)
    out_dir = out_dir or str(config.PAGES_DIR)

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(
            f"Summer School PDF not found at {pdf_path}. "
            f"Expected it at {config.SOURCE_PDF}."
        )

    image_paths = render_pdf_to_pngs(pdf_path, out_dir, dpi=dpi)
    if not image_paths:
        raise RuntimeError(f"PDF rendered zero pages: {pdf_path}")
    return image_paths


def verify_page_order(out_dir: Optional[str] = None) -> List[str]:
    """Return rendered page paths in strict numeric page order.

    Deterministic filenames (page_001.png ... ) make the order check trivial:
    we sort by the zero-padded page number embedded in the filename.
    """
    out_dir = out_dir or str(config.PAGES_DIR)
    if not os.path.isdir(out_dir):
        raise FileNotFoundError(f"No rendered pages directory at {out_dir}")

    names = []
    for name in os.listdir(out_dir):
        if not name.startswith("page_") or not name.endswith(".png"):
            continue
        stem = name[len("page_") : -len(".png")]
        if not stem.isdigit():
            continue
        names.append(name)

    names.sort(key=lambda n: int(n[len("page_"):-len(".png")]))
    return [os.path.join(out_dir, n) for n in names]


def build_manifest(image_paths: List[str]) -> Dict[str, Any]:
    """Describe the rendered page set (page number + absolute path each)."""
    return {
        "sourceFile": config.SOURCE_PDF_NAME,
        "dpi": config.DEFAULT_DPI,
        "pageCount": len(image_paths),
        "pages": [
            {
                "page": int(os.path.basename(p).split("_")[1].split(".")[0]),
                "path": p,
            }
            for p in image_paths
        ],
    }


def main() -> None:
    """CLI: render SummerSchool2627.pdf pages to PNG."""
    import argparse

    parser = argparse.ArgumentParser(description="Render the Summer School PDF to PNG pages.")
    parser.add_argument("--pdf", default=None, help="Path to the Summer School PDF.")
    parser.add_argument("--out", default=None, help="Output directory for PNGs.")
    parser.add_argument("--dpi", type=int, default=config.DEFAULT_DPI, help="Render DPI.")
    parser.add_argument("--verify", action="store_true", help="Verify page ordering after render.")
    args = parser.parse_args()

    print(f"Rendering {args.pdf or config.SOURCE_PDF} at {args.dpi or config.DEFAULT_DPI} DPI ...")
    paths = render_summer_pdf(args.pdf, args.out, dpi=args.dpi)
    print(f"Rendered {len(paths)} pages.")
    print("Manifest:", __import__("json").dumps(build_manifest(paths), indent=2))

    if args.verify:
        ordered = verify_page_order(args.out)
        print(f"Order verified: {len(ordered)} pages in ascending order.")


if __name__ == "__main__":
    main()
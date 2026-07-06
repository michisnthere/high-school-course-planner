"""Render PDF pages to high-resolution PNGs using PyMuPDF.

The renderer produces 300 DPI PNG files named page_001.png, page_002.png, ...
under the configured output directory.
"""

from __future__ import annotations

import os
from typing import List


def render_pdf_to_pngs(pdf_path: str, out_dir: str, dpi: int = 300) -> List[str]:
    try:
        import fitz
    except ImportError as exc:
        raise RuntimeError(
            "PyMuPDF is required to render PDFs. Install with `pip install pymupdf`."
        ) from exc

    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    image_paths: List[str] = []
    matrix = fitz.Matrix(dpi / 72, dpi / 72)

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        image_name = f"page_{page_index + 1:03d}.png"
        path = os.path.join(out_dir, image_name)
        pix.save(path)
        image_paths.append(path)

    return image_paths

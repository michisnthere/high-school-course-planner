from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
VENDOR_DIR = PROJECT_ROOT / ".vendor"
if VENDOR_DIR.exists():
    sys.path.insert(0, str(VENDOR_DIR))

from pypdf import PdfReader

from src.pdf.classify_page import classify_page
from src.rules.clean_text import clean_text

DEFAULT_PDF = PROJECT_ROOT / "Coursebook2026-27INTERACTIVE101725.pdf"
RAW_TEXT_DIR = PROJECT_ROOT / "data" / "raw-text"
REPORTS_DIR = PROJECT_ROOT / "data" / "reports"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract raw text and page checks for all coursebook pages.")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF, help="Path to the coursebook PDF.")
    parser.add_argument("--start", type=int, default=1, help="First 1-based PDF page to process.")
    parser.add_argument("--end", type=int, help="Last 1-based PDF page to process. Defaults to the final page.")
    return parser.parse_args()


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    args = parse_args()
    RAW_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(args.pdf))
    end_page = args.end or len(reader.pages)
    if args.start < 1 or end_page > len(reader.pages) or args.start > end_page:
        raise ValueError(f"Invalid page range {args.start}-{end_page}; PDF has {len(reader.pages)} pages.")

    counts: dict[str, int] = {}
    for page_number in range(args.start, end_page + 1):
        text = reader.pages[page_number - 1].extract_text() or ""
        text = clean_text(text)
        page_check = classify_page(text)
        classification = page_check["classification"]
        counts[classification] = counts.get(classification, 0) + 1

        raw_path = RAW_TEXT_DIR / f"page-{page_number:03}.txt"
        check_path = REPORTS_DIR / f"page-{page_number:03}-page-check.json"
        raw_path.write_text(text, encoding="utf-8")
        write_json(check_path, page_check)

        if page_number % 10 == 0 or page_number == end_page:
            print(f"Processed page {page_number}/{end_page}")

    summary = {
        "pdf": str(args.pdf),
        "startPage": args.start,
        "endPage": end_page,
        "pagesChecked": end_page - args.start + 1,
        "classificationCounts": counts,
    }
    write_json(REPORTS_DIR / "raw-text-extraction-report.json", summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

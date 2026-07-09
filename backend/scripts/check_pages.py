from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.pdf.classify_page import classify_page
from src.pdf.extract_text import extract_page_text

DEFAULT_PDF = PROJECT_ROOT / "Coursebook2026-27INTERACTIVE101725.pdf"
RAW_TEXT_DIR = PROJECT_ROOT / "data" / "raw-text"
REPORTS_DIR = PROJECT_ROOT / "data" / "reports"
DEFAULT_PAGES = [17, 18, 22]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Classify PDF pages and save page-check reports.")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF, help="PDF file to inspect.")
    parser.add_argument("--pages", nargs="+", type=int, default=DEFAULT_PAGES, help="Page numbers to classify. Defaults to 17, 18, 22.")
    return parser.parse_args()


def prepare_output_dirs() -> None:
    RAW_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def write_page_report(page_number: int, text: str, page_check: dict[str, Any]) -> None:
    raw_path = RAW_TEXT_DIR / f"page-{page_number:03}.txt"
    report_path = REPORTS_DIR / f"page-{page_number:03}-page-check.json"
    raw_path.write_text(text, encoding="utf-8")
    report_path.write_text(json.dumps(page_check, indent=2), encoding="utf-8")
    print(f"Page {page_number}: {page_check['classification']} (shouldExtract={page_check['shouldExtract']})")
    print(f"  raw: {raw_path}")
    print(f"  report: {report_path}")


def main() -> None:
    args = parse_args()
    prepare_output_dirs()

    for page_number in args.pages:
        text = extract_page_text(args.pdf, page_number)
        page_check = classify_page(text)
        write_page_report(page_number, text, page_check)


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.ai.extract_academic_data import build_academic_extraction_prompt, call_openai
from src.pdf.classify_page import classify_page
from src.pdf.extract_text import extract_page_text

DEFAULT_PDF = PROJECT_ROOT / "Coursebook2026-27INTERACTIVE101725.pdf"
RAW_TEXT_DIR = PROJECT_ROOT / "data" / "raw-text"
REPORTS_DIR = PROJECT_ROOT / "data" / "reports"
STRUCTURED_DIR = PROJECT_ROOT / "data" / "structured"
DEFAULT_PAGE = 18


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract one page from the coursebook and optionally run AI extraction.")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF, help="Path to the coursebook PDF.")
    parser.add_argument("--page", type=int, default=DEFAULT_PAGE, help="Page number to extract. Defaults to 18.")
    parser.add_argument("--force", action="store_true", help="Force AI extraction even if the classifier marks the page as non-extractable.")
    parser.add_argument("--ai", action="store_true", help="Run AI extraction using OPENAI_API_KEY.")
    parser.add_argument("--model", default=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"), help="OpenAI model name.")
    return parser.parse_args()


def prepare_output_dirs() -> None:
    RAW_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    STRUCTURED_DIR.mkdir(parents=True, exist_ok=True)


def write_page_outputs(page_number: int, text: str, page_check: dict[str, Any]) -> dict[str, Any]:
    raw_path = RAW_TEXT_DIR / f"page-{page_number:03}.txt"
    check_path = REPORTS_DIR / f"page-{page_number:03}-page-check.json"
    prompt_path = REPORTS_DIR / f"page-{page_number:03}-ai-prompt.txt"

    raw_path.write_text(text, encoding="utf-8")
    check_path.write_text(json.dumps(page_check, indent=2), encoding="utf-8")
    prompt_text = build_academic_extraction_prompt(page_number, text)
    prompt_path.write_text(prompt_text, encoding="utf-8")

    return {
        "rawPath": raw_path,
        "checkPath": check_path,
        "promptPath": prompt_path,
        "pageCheck": page_check,
    }


def print_page_check(page_number: int, page_check: dict[str, Any]) -> None:
    print(
        f"Page {page_number}: {page_check['classification']} "
        f"(course signals={page_check['courseSignalCount']}, policy signals={page_check['policySignalCount']}, shouldExtract={page_check['shouldExtract']})"
    )


def main() -> None:
    args = parse_args()
    prepare_output_dirs()

    text = extract_page_text(args.pdf, args.page)
    page_check = classify_page(text)
    outputs = write_page_outputs(args.page, text, page_check)

    print_page_check(args.page, page_check)
    print(f"Wrote raw text to {outputs['rawPath']}")
    print(f"Wrote page check to {outputs['checkPath']}")
    print(f"Wrote AI prompt preview to {outputs['promptPath']}")

    if not page_check["shouldExtract"] and not args.force:
        print("Skipping AI extraction because this page is not classified as extractable. Use --force to override.")
        return

    if not args.ai:
        print("AI extraction skipped. Set OPENAI_API_KEY and pass --ai to run extraction.")
        return

    structured = call_openai(args.model, outputs["promptPath"].read_text(encoding="utf-8"))
    json_path = STRUCTURED_DIR / f"page-{args.page:03}.extracted.json"
    json_path.write_text(json.dumps(structured, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved structured extraction to {json_path}")


if __name__ == "__main__":
    main()

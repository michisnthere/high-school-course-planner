"""Extract one course-content PDF page and optionally run AI structured extraction.

Default behavior extracts page 18, where course content begins in the current
coursebook. The script also includes a lightweight page classifier so front
matter pages can be skipped before AI tokens are spent.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
VENDOR_DIR = PROJECT_ROOT / ".vendor"
if VENDOR_DIR.exists():
    sys.path.insert(0, str(VENDOR_DIR))

try:
    from pypdf import PdfReader
except ImportError as exc:
    raise SystemExit(
        "Missing dependency: pypdf. Install it with:\n"
        "python -m pip install pypdf -t .vendor"
    ) from exc

DEFAULT_PDF = PROJECT_ROOT / "Coursebook2026-27INTERACTIVE101725.pdf"
DEFAULT_START_PAGE = 18
RAW_TEXT_DIR = PROJECT_ROOT / "data" / "raw-text"
STRUCTURED_DIR = PROJECT_ROOT / "data" / "structured"
REPORTS_DIR = PROJECT_ROOT / "data" / "reports"

COURSE_PATTERNS = {
    "course_code": re.compile(r"\b[A-Z]{2,5}\d{3}\b"),
    "open_to": re.compile(r"\bOPEN\s+TO\s*:", re.IGNORECASE),
    "prerequisite": re.compile(r"\bPREREQUISITE\s*:", re.IGNORECASE),
    "credit": re.compile(r"\bCREDIT\s*:", re.IGNORECASE),
    "semester": re.compile(r"\bSEMESTER\s*(1|2)?\b", re.IGNORECASE),
    "duration": re.compile(r"\bONE\s+SEMESTER\b|\bFULL\s+YEAR\b", re.IGNORECASE),
    "gpa_waiver": re.compile(r"\bGPA\s+WAIVER\s+OPTION\b", re.IGNORECASE),
}

POLICY_PATTERNS = {
    "graduation": re.compile(r"\bGRADUATION\s+REQUIREMENTS?\b", re.IGNORECASE),
    "requirement": re.compile(r"\bREQUIREMENTS?\b", re.IGNORECASE),
    "waiver": re.compile(r"\bWAIVER\b", re.IGNORECASE),
    "physical_education": re.compile(r"\bPHYSICAL\s+EDUCATION\b", re.IGNORECASE),
    "drivers_ed": re.compile(r"\bDRIVER'?S?\s+EDUCATION\b", re.IGNORECASE),
    "civics": re.compile(r"\bCIVICS\b|\bPATRIOTISM\b", re.IGNORECASE),
    "economics": re.compile(r"\bECONOMICS\b", re.IGNORECASE),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract one course-content page from the coursebook and optionally parse it with AI."
    )
    parser.add_argument(
        "--pdf",
        type=Path,
        default=DEFAULT_PDF,
        help="Path to the coursebook PDF. Defaults to the PDF in the project root.",
    )
    parser.add_argument(
        "--page",
        type=int,
        default=DEFAULT_START_PAGE,
        help="1-based page number to extract. Defaults to 18, the first course-content page in the current coursebook.",
    )
    parser.add_argument(
        "--check-pages",
        nargs="+",
        type=int,
        help="Classify one or more pages and write page-check reports without running AI extraction.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Run extraction even if the page classifier says the page is not useful academic content.",
    )
    parser.add_argument(
        "--ai",
        action="store_true",
        help="Send the extracted page text to OpenAI and save structured JSON.",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
        help="OpenAI model name. Can also be set with OPENAI_MODEL.",
    )
    return parser.parse_args()


def load_reader(pdf_path: Path) -> PdfReader:
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    return PdfReader(str(pdf_path))


def extract_page_text_from_reader(reader: PdfReader, page_number: int) -> str:
    if page_number < 1:
        raise ValueError("Page number must be 1 or greater.")
    if page_number > len(reader.pages):
        raise ValueError(f"PDF has only {len(reader.pages)} pages; page {page_number} is out of range.")

    page = reader.pages[page_number - 1]
    return page.extract_text() or ""


def classify_page(text: str) -> dict[str, Any]:
    normalized = " ".join(text.split())
    course_matches = {
        name: len(pattern.findall(normalized))
        for name, pattern in COURSE_PATTERNS.items()
    }
    policy_matches = {
        name: len(pattern.findall(normalized))
        for name, pattern in POLICY_PATTERNS.items()
    }

    course_score = sum(course_matches.values())
    policy_score = sum(policy_matches.values())
    has_course_code = course_matches["course_code"] > 0
    detailed_metadata_count = (
        course_matches["open_to"]
        + course_matches["prerequisite"]
        + course_matches["credit"]
        + course_matches["gpa_waiver"]
    )
    has_duration_or_semester = (course_matches["semester"] + course_matches["duration"]) > 0

    is_detailed_course_content = has_course_code and detailed_metadata_count >= 2 and has_duration_or_semester
    is_course_listing_summary = has_course_code and has_duration_or_semester and not is_detailed_course_content
    is_academic_policy_content = policy_score >= 2
    should_extract = is_detailed_course_content or is_academic_policy_content

    if is_detailed_course_content:
        classification = "detailed_course_content"
    elif is_course_listing_summary:
        classification = "course_listing_summary"
    elif is_academic_policy_content:
        classification = "academic_policy_content"
    elif len(normalized) < 250:
        classification = "front_matter_or_sparse_page"
    else:
        classification = "unknown_or_non_course_content"

    return {
        "classification": classification,
        "shouldExtract": should_extract,
        "isCourseContent": is_detailed_course_content,
        "isCourseListingSummary": is_course_listing_summary,
        "isAcademicPolicyContent": is_academic_policy_content,
        "characterCount": len(text),
        "courseSignalCount": course_score,
        "policySignalCount": policy_score,
        "courseSignals": course_matches,
        "policySignals": policy_matches,
        "preview": normalized[:500],
    }


def write_page_outputs(page_number: int, text: str) -> dict[str, Any]:
    raw_path = RAW_TEXT_DIR / f"page-{page_number:03}.txt"
    check_path = REPORTS_DIR / f"page-{page_number:03}-page-check.json"
    prompt_path = REPORTS_DIR / f"page-{page_number:03}-ai-prompt.txt"

    page_check = classify_page(text)
    raw_path.write_text(text, encoding="utf-8")
    check_path.write_text(json.dumps(page_check, indent=2), encoding="utf-8")
    prompt_path.write_text(build_ai_prompt(page_number, text), encoding="utf-8")

    return {
        "rawPath": raw_path,
        "checkPath": check_path,
        "promptPath": prompt_path,
        "pageCheck": page_check,
    }


def build_ai_prompt(page_number: int, text: str) -> str:
    return f"""
You are extracting structured academic data from one page of a high school coursebook.
Return only valid JSON. Do not invent missing information.

Extract any courses, course offerings, departments, graduation requirements, requirement rules,
waivers, prerequisites, co-requisites, credits, grade levels, and notes visible on this page.

Use this JSON shape:
{{
  "sourcePage": {page_number},
  "departments": [
    {{
      "name": "string or null",
      "description": "string or null"
    }}
  ],
  "courses": [
    {{
      "title": "string",
      "department": "string or null",
      "description": "string or null",
      "gpaWaiverOption": true,
      "offerings": [
        {{
          "courseCode": "string or null",
          "semesterLabel": "string or null",
          "duration": "string or null",
          "gradeLevels": [9, 10, 11, 12],
          "prerequisites": ["string"],
          "corequisites": ["string"],
          "creditType": "string or null",
          "credits": null
        }}
      ],
      "notes": ["string"],
      "sourceReference": "string or null"
    }}
  ],
  "graduationRequirements": [
    {{
      "name": "string",
      "category": "string or null",
      "requirementType": "credits | semesters | completion | waiver | policy | unknown",
      "requiredValue": "number, string, or null",
      "eligibleCourses": ["string"],
      "waiverRules": ["string"],
      "notes": ["string"],
      "sourceReference": "string or null"
    }}
  ],
  "warnings": ["string"]
}}

Page text:
{text}
""".strip()


def call_openai(model: str, prompt: str) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Set it to run with --ai.")

    payload = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt,
                    }
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_object",
            }
        },
    }

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI request failed: {exc.code} {body}") from exc

    output_text = result.get("output_text")
    if not output_text:
        parts = []
        for item in result.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in {"output_text", "text"}:
                    parts.append(content.get("text", ""))
        output_text = "".join(parts)

    if not output_text:
        raise RuntimeError("OpenAI response did not contain output_text.")

    return json.loads(output_text)


def prepare_output_dirs() -> None:
    RAW_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    STRUCTURED_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def print_page_check(page_number: int, page_check: dict[str, Any]) -> None:
    print(
        f"Page {page_number}: {page_check['classification']} "
        f"(course signals: {page_check['courseSignalCount']}, "
        f"policy signals: {page_check['policySignalCount']}, "
        f"should extract: {page_check['shouldExtract']})"
    )


def main() -> None:
    args = parse_args()
    prepare_output_dirs()
    reader = load_reader(args.pdf)

    if args.check_pages:
        for page_number in args.check_pages:
            text = extract_page_text_from_reader(reader, page_number)
            outputs = write_page_outputs(page_number, text)
            print_page_check(page_number, outputs["pageCheck"])
            print(f"  report: {outputs['checkPath']}")
        return

    page_number = args.page
    text = extract_page_text_from_reader(reader, page_number)
    outputs = write_page_outputs(page_number, text)
    page_check = outputs["pageCheck"]

    print_page_check(page_number, page_check)
    print(f"Extracted page {page_number} raw text to: {outputs['rawPath']}")
    print(f"Saved page check to: {outputs['checkPath']}")
    print(f"Saved AI prompt preview to: {outputs['promptPath']}")
    print(f"Characters extracted: {len(text)}")

    if not page_check["shouldExtract"] and not args.force:
        print("Skipping AI extraction because this page does not look like detailed course or policy content.")
        print("Re-run with --force if you want to extract it anyway.")
        return

    if not args.ai:
        print("AI extraction skipped. Re-run with --ai after setting OPENAI_API_KEY.")
        return

    structured = call_openai(args.model, outputs["promptPath"].read_text(encoding="utf-8"))
    json_path = STRUCTURED_DIR / f"page-{page_number:03}.extracted.json"
    json_path.write_text(json.dumps(structured, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved AI structured extraction to: {json_path}")


if __name__ == "__main__":
    main()


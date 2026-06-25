from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
VENDOR_DIR = PROJECT_ROOT / ".vendor"
if VENDOR_DIR.exists():
    sys.path.insert(0, str(VENDOR_DIR))

from pypdf import PdfReader

from src.pdf.classify_page import classify_page
from src.rules.clean_text import clean_text
from src.rules.normalize_catalog import normalize_catalog, normalize_departments
from src.rules.parse_courses import parse_course_page
from src.rules.parse_requirements import parse_requirement_page

DEFAULT_PDF = PROJECT_ROOT / "Coursebook2026-27INTERACTIVE101725.pdf"
RAW_TEXT_DIR = PROJECT_ROOT / "data" / "raw-text"
REPORTS_DIR = PROJECT_ROOT / "data" / "reports"
RULE_PAGES_DIR = PROJECT_ROOT / "data" / "structured" / "rule-pages"
DRAFT_PATH = PROJECT_ROOT / "data" / "structured" / "academic-data.rule-based-draft.json"
EXTRACTED_PATH = PROJECT_ROOT / "data" / "extracted_courses.json"
DB_READY_PATH = PROJECT_ROOT / "data" / "db_ready_courses.json"
REPORT_PATH = PROJECT_ROOT / "data" / "reports" / "rule-extraction-report.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run non-AI rule-based extraction across the coursebook.")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF, help="Path to the coursebook PDF.")
    parser.add_argument("--start", type=int, default=1, help="First 1-based PDF page to process.")
    parser.add_argument("--end", type=int, help="Last 1-based PDF page to process. Defaults to the final page.")
    parser.add_argument("--include-summaries", action="store_true", help="Write page JSON for course listing summary pages too, for review.")
    return parser.parse_args()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")


def merge_page_result(combined: Dict[str, Any], page_result: Dict[str, Any]) -> None:
    seen_departments = {(item.get("name"), item.get("description")) for item in combined["departments"]}
    for department in page_result.get("departments", []):
        key = (department.get("name"), department.get("description"))
        if department.get("name") and key not in seen_departments:
            combined["departments"].append(department)
            seen_departments.add(key)

    combined["courses"].extend(page_result.get("courses", []))
    combined["graduationRequirements"].extend(page_result.get("graduationRequirements", []))
    for warning in page_result.get("warnings", []):
        combined["warnings"].append(warning)


def build_empty_page_result(page_number: int) -> Dict[str, Any]:
    return {
        "sourcePage": page_number,
        "departments": [],
        "courses": [],
        "graduationRequirements": [],
        "warnings": [],
    }


def validate_export_invariants(courses: List[Dict[str, Any]]) -> Dict[str, int]:
    total_courses = len(courses)
    total_offerings = sum(len(course.get("offerings", [])) for course in courses)
    codes: List[str] = []
    empty_titles: List[str] = []

    for course in courses:
        title = course.get("title")
        if not isinstance(title, str) or not title.strip():
            empty_titles.append(str(course.get("sourceReference", "unknown source")))
        for offering in course.get("offerings", []):
            code = offering.get("courseCode")
            if code:
                codes.append(code)

    duplicates = sorted({code for code in codes if codes.count(code) > 1})
    failures = []
    if total_courses != 225:
        failures.append(f"expected 225 courses, got {total_courses}")
    if total_offerings != 452:
        failures.append(f"expected 452 offerings, got {total_offerings}")
    if duplicates:
        failures.append(f"duplicate course codes: {duplicates}")
    if empty_titles:
        failures.append(f"empty course titles at: {empty_titles}")

    if failures:
        raise ValueError("Export validation failed: " + "; ".join(failures))

    return {
        "totalCourses": total_courses,
        "totalOfferings": total_offerings,
        "uniqueCourseCodes": len(set(codes)),
        "duplicateCourseCodes": len(duplicates),
        "emptyCourseTitles": len(empty_titles),
    }


def build_export_catalog(combined: Dict[str, Any], db_ready: bool = False) -> Dict[str, Any]:
    catalog = copy.deepcopy(combined)
    catalog["departments"] = normalize_departments(catalog.get("departments", []))
    catalog["courses"] = normalize_catalog(catalog.get("courses", []), db_ready=db_ready)
    return catalog


def main() -> None:
    args = parse_args()
    RAW_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    RULE_PAGES_DIR.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(args.pdf))
    end_page = args.end or len(reader.pages)
    if args.start < 1 or end_page > len(reader.pages) or args.start > end_page:
        raise ValueError(f"Invalid page range {args.start}-{end_page}; PDF has {len(reader.pages)} pages.")

    combined: Dict[str, Any] = {
        "sourceFile": str(args.pdf),
        "departments": [],
        "courses": [],
        "graduationRequirements": [],
        "warnings": [],
    }
    report: Dict[str, Any] = {
        "sourceFile": str(args.pdf),
        "startPage": args.start,
        "endPage": end_page,
        "pagesChecked": 0,
        "pagesExtracted": 0,
        "pagesSkipped": 0,
        "classificationCounts": {},
        "extractedPages": [],
        "skippedPages": [],
        "uncertainPages": [],
        "pageSummaries": [],
    }

    for page_number in range(args.start, end_page + 1):
        text = reader.pages[page_number - 1].extract_text() or ""
        text = clean_text(text)
        page_check = classify_page(text)
        classification = page_check["classification"]
        report["pagesChecked"] += 1
        report["classificationCounts"][classification] = report["classificationCounts"].get(classification, 0) + 1

        raw_path = RAW_TEXT_DIR / f"page-{page_number:03}.txt"
        check_path = REPORTS_DIR / f"page-{page_number:03}-page-check.json"
        raw_path.write_text(text, encoding="utf-8")
        write_json(check_path, page_check)

        has_full_course_metadata = all(token in text.lower() for token in ["open to:", "prerequisite:", "credit:"])
        should_parse_courses = classification == "detailed_course_content" or (classification == "course_listing_summary" and has_full_course_metadata)
        should_parse_requirements = page_check.get("isAcademicPolicyContent", False) and classification != "course_listing_summary"
        should_write_summary = args.include_summaries and classification == "course_listing_summary"

        page_result = build_empty_page_result(page_number)
        if should_parse_courses:
            course_result = parse_course_page(page_number, text, classification)
            page_result["departments"].extend(course_result.get("departments", []))
            page_result["courses"].extend(course_result.get("courses", []))
            page_result["warnings"].extend(course_result.get("warnings", []))
        if should_parse_requirements:
            requirement_result = parse_requirement_page(page_number, text)
            page_result["graduationRequirements"].extend(requirement_result.get("graduationRequirements", []))
            page_result["warnings"].extend(requirement_result.get("warnings", []))

        extracted_any = bool(page_result["courses"] or page_result["graduationRequirements"])
        if extracted_any or should_write_summary:
            page_json_path = RULE_PAGES_DIR / f"page-{page_number:03}.rule.json"
            write_json(page_json_path, page_result)
            if extracted_any:
                merge_page_result(combined, page_result)
                report["pagesExtracted"] += 1
                report["extractedPages"].append(page_number)
            else:
                report["pagesSkipped"] += 1
                report["skippedPages"].append({"page": page_number, "classification": classification})
        else:
            report["pagesSkipped"] += 1
            report["skippedPages"].append({"page": page_number, "classification": classification})

        if page_result["warnings"] or (should_parse_courses and not page_result["courses"]):
            report["uncertainPages"].append({
                "page": page_number,
                "classification": classification,
                "warnings": page_result["warnings"] or ["No courses parsed from detailed course page."],
            })

        report["pageSummaries"].append({
            "page": page_number,
            "classification": classification,
            "courses": len(page_result["courses"]),
            "graduationRequirements": len(page_result["graduationRequirements"]),
            "warnings": len(page_result["warnings"]),
        })

        if page_number % 10 == 0 or page_number == end_page:
            print(f"Processed page {page_number}/{end_page}")

    report["totalCourses"] = len(combined["courses"])
    report["totalCourseOfferings"] = sum(len(course.get("offerings", [])) for course in combined["courses"])
    report["totalGraduationRequirements"] = len(combined["graduationRequirements"])
    report["totalWarnings"] = len(combined["warnings"])

    standard_catalog = build_export_catalog(combined, db_ready=False)
    db_ready_catalog = build_export_catalog(combined, db_ready=True)
    validation = validate_export_invariants(standard_catalog["courses"])
    db_ready_validation = validate_export_invariants(db_ready_catalog["courses"])
    if validation != db_ready_validation:
        raise ValueError(f"DB-ready validation mismatch: {validation} != {db_ready_validation}")

    report["exportValidation"] = validation

    write_json(DRAFT_PATH, standard_catalog)
    write_json(EXTRACTED_PATH, standard_catalog)
    write_json(DB_READY_PATH, db_ready_catalog)
    write_json(REPORT_PATH, report)
    print(json.dumps({
        "pagesChecked": report["pagesChecked"],
        "pagesExtracted": report["pagesExtracted"],
        "pagesSkipped": report["pagesSkipped"],
        "totalCourses": report["totalCourses"],
        "totalCourseOfferings": report["totalCourseOfferings"],
        "totalGraduationRequirements": report["totalGraduationRequirements"],
        "totalWarnings": report["totalWarnings"],
        "exportValidation": validation,
        "draftPath": str(DRAFT_PATH),
        "extractedPath": str(EXTRACTED_PATH),
        "dbReadyPath": str(DB_READY_PATH),
        "reportPath": str(REPORT_PATH),
    }, indent=2))


if __name__ == "__main__":
    main()



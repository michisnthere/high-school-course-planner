from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from src.rules.clean_text import (
    clean_description,
    clean_text,
    collapse_spaces,
    normalize_credit_type,
    parse_grade_levels,
    split_list_text,
    title_from_heading,
    without_footer_lines,
)

COURSE_CODE_RE = re.compile(r"\b[A-Z]{2,5}\d{2,3}[A-Z]?\d?\b")
CODE_WITH_SEMESTER_RE = re.compile(r"\b(?P<code>[A-Z]{2,5}\d{2,3}[A-Z]?\d?)\s*[-–]\s*(?P<semester>Semester\s+[12](?:\s+Only|\s+only)?)", re.IGNORECASE)
METADATA_RE = re.compile(r"\b(Open to:|Prerequisite:|Credit:|GPA WAIVER OPTION|One Semester|Full Year|Semester\s+[12])\b", re.IGNORECASE)
TITLE_EXCLUDE = {
    "GPA WAIVER OPTION",
    "EARLY BIRD OPTION",
    "DUAL CREDIT AVAILABLE AT NO COST THROUGH COLLEGE OF LAKE COUNTY",
    "ARTICULATED CREDIT WITH COLLEGE OF LAKE COUNTY",
}


def parse_course_page(page_number: int, raw_text: str, classification: str = "detailed_course_content") -> Dict[str, Any]:
    text = clean_text(raw_text)
    lines = without_footer_lines(text.splitlines())
    departments = _extract_departments(lines)
    department_name = departments[0]["name"] if departments else None
    title_spans = _find_course_title_spans(lines)
    courses: List[Dict[str, Any]] = []
    warnings: List[str] = []
    _infer_credits.inferred_count = 0

    if not title_spans:
        return _empty_result(page_number, departments, [f"No course boundaries found on page {page_number}."])

    for position, start in enumerate(title_spans):
        end = title_spans[position + 1] if position + 1 < len(title_spans) else len(lines)
        section_lines = lines[start:end]
        course = _parse_course_section(page_number, section_lines, department_name, warnings)
        if course:
            courses.append(course)
        else:
            preview = collapse_spaces(" ".join(section_lines))[:160]
            warnings.append(f"Page {page_number}: failed to parse possible course section: {preview}")

    inferred = getattr(_infer_credits, "inferred_count", 0)
    if inferred:
        warnings.append(f"Page {page_number}: credit inference count = {inferred}")
    return {
        "sourcePage": page_number,
        "departments": departments,
        "courses": courses,
        "graduationRequirements": [],
        "warnings": warnings,
    }


def _empty_result(page_number: int, departments: List[Dict[str, Any]], warnings: List[str]) -> Dict[str, Any]:
    return {
        "sourcePage": page_number,
        "departments": departments,
        "courses": [],
        "graduationRequirements": [],
        "warnings": warnings,
    }


def _extract_departments(lines: List[str]) -> List[Dict[str, Optional[str]]]:
    if not lines:
        return []
    first = lines[0]
    first_lookahead = " ".join(lines[1:6])
    if _looks_like_course_title_candidate(first) and COURSE_CODE_RE.search(first_lookahead):
        if "–" not in first and "—" not in first:
            return []
    if not _looks_like_department_line(first):
        return []

    dept_name = title_from_heading(re.sub(r"\s+\d+$", "", first))
    description_parts: List[str] = []
    for line in lines[1:10]:
        if _looks_like_course_title_candidate(line):
            break
        if METADATA_RE.search(line) or COURSE_CODE_RE.search(line):
            break
        description_parts.append(line)
    description = clean_description(" ".join(description_parts)) if description_parts else None
    return [{"name": dept_name, "description": description}]


def _looks_like_department_line(line: str) -> bool:
    stripped = line.strip()
    if len(stripped) < 4 or len(stripped) > 90:
        return False
    if COURSE_CODE_RE.search(stripped):
        return False
    letters = re.sub(r"[^A-Za-z]", "", stripped)
    return bool(letters) and letters.upper() == letters


def _find_course_title_spans(lines: List[str]) -> List[int]:
    spans: List[int] = []
    for index, line in enumerate(lines):
        if not _looks_like_course_title_candidate(line):
            continue
        lookahead = " ".join(lines[index + 1:index + 6])
        if COURSE_CODE_RE.search(lookahead) and METADATA_RE.search(lookahead):
            spans.append(index)
    return spans


def _looks_like_course_title_candidate(line: str) -> bool:
    stripped = collapse_spaces(line)
    if stripped.startswith("DUAL CREDIT"):
        return False
    if stripped in TITLE_EXCLUDE:
        return False
    if stripped in {"LAKE COUNTY", "COLLEGE OF", "AND TECHNOLOGY"}:
        return False
    if len(stripped) < 3 or len(stripped) > 80:
        return False
    if any(mark in stripped for mark in [",", ".", ":"]):
        return False
    if len(stripped.split()) > 7:
        return False
    if stripped.endswith(" COURSE OFFERINGS"):
        return False
    if METADATA_RE.search(stripped) or COURSE_CODE_RE.search(stripped):
        return False
    letters = re.sub(r"[^A-Za-z]", "", stripped)
    if not letters:
        return False
    return letters.upper() == letters


def _parse_course_section(page_number: int, lines: List[str], department_name: Optional[str], warnings: List[str]) -> Optional[Dict[str, Any]]:
    if not lines:
        return None
    title = title_from_heading(lines[0])
    section = "\n".join(lines)
    if not COURSE_CODE_RE.search(section):
        return None

    gpa_waiver = bool(re.search(r"\bGPA\s+WAIVER\s+OPTION\b", section, re.IGNORECASE))
    offerings = _extract_offerings(section, warnings, page_number, title)
    if not offerings:
        return None

    description = _extract_description(lines)
    credit_type = _extract_credit_type(section)
    grades = _extract_grades(section)
    prerequisites = _extract_prerequisites(section)
    notes = _extract_notes(lines)

    for offering in offerings:
        offering["duration"] = offering.get("duration") or _extract_duration(section)
        offering["gradeLevels"] = grades
        offering["prerequisites"] = prerequisites
        offering["corequisites"] = []
        offering["creditType"] = credit_type
        offering["credits"] = _infer_credits(section, description, offering["courseCode"], warnings, page_number, title)

    if any(note.startswith("Complex prerequisite") for note in notes):
        warnings.append(f"Page {page_number} {title}: complex prerequisite text preserved in notes; review manually.")

    return {
        "title": title,
        "department": department_name,
        "description": description,
        "gpaWaiverOption": gpa_waiver,
        "offerings": offerings,
        "notes": notes,
        "sourceReference": f"Page {page_number}",
    }


def _extract_offerings(section: str, warnings: List[str], page_number: int, title: str) -> List[Dict[str, Any]]:
    offerings: List[Dict[str, Any]] = []
    for match in CODE_WITH_SEMESTER_RE.finditer(section):
        semester = collapse_spaces(match.group("semester")).replace("only", "Only")
        offerings.append({
            "courseCode": match.group("code"),
            "semesterLabel": semester,
            "duration": None,
            "gradeLevels": [],
            "prerequisites": [],
            "corequisites": [],
            "creditType": None,
            "credits": None,
        })
    seen = set()
    deduped = []
    for offering in offerings:
        code = offering["courseCode"]
        if code in seen:
            continue
        seen.add(code)
        deduped.append(offering)
    if not deduped:
        warnings.append(f"Page {page_number} {title}: no course offerings matched code-semester pattern.")
    return deduped


def _extract_duration(section: str) -> Optional[str]:
    if re.search(r"\bFull\s+Year\b", section, re.IGNORECASE):
        return "Full Year"
    if re.search(r"\bOne\s+Semester\b", section, re.IGNORECASE):
        return "One Semester"
    return None


def _extract_grades(section: str) -> List[int]:
    match = re.search(r"Open\s+to:\s*([0-9\-\s]+)", section, re.IGNORECASE)
    return parse_grade_levels(match.group(1)) if match else []


def _extract_credit_type(section: str) -> Optional[str]:
    match = re.search(r"\bCredit:\s*(.+?)(?:\n|$)", section, re.IGNORECASE)
    return normalize_credit_type(match.group(1)) if match else None


def _extract_prerequisites(section: str) -> List[str]:
    match = re.search(r"Prerequisite:\s*(.+?)(?=\s+Credit:|\s+credit:|\n\s*Credit:|\n\s*credit:|\n[A-Z][a-z]|$)", section, re.IGNORECASE | re.DOTALL)
    if not match:
        return []
    cleaned = clean_description(match.group(1))
    cleaned = re.sub(r"\s+credit:\s*.*$", "", cleaned, flags=re.IGNORECASE).strip()
    if not cleaned or cleaned.lower() == "none":
        return []
    if "One course required from" in cleaned:
        return [cleaned]
    return split_list_text(cleaned)


def _extract_notes(lines: List[str]) -> List[str]:
    notes: List[str] = []
    section = "\n".join(lines)
    if "ARTICULATED CREDIT WITH COLLEGE OF LAKE COUNTY" in section:
        notes.append("Articulated credit with College of Lake County.")
    if "DUAL CREDIT AVAILABLE AT NO COST THROUGH COLLEGE OF LAKE COUNTY" in section:
        notes.append("Dual credit available at no cost through College of Lake County.")
    if "EARLY BIRD OPTION" in section:
        notes.append("Early Bird option listed on page.")
    prereqs = _extract_prerequisites(section)
    if prereqs and any("One course required from" in prereq for prereq in prereqs):
        notes.append(f"Complex prerequisite: {prereqs[0]}")
    for match in re.finditer(r"\bNote:\s*(.+?)(?=\n[A-Z]|$)", section, re.IGNORECASE | re.DOTALL):
        notes.append(clean_description(match.group(1)))
    return notes


def _extract_description(lines: List[str]) -> Optional[str]:
    start_index: Optional[int] = None
    for index, line in enumerate(lines):
        if re.search(r"\bCredit:\s*", line, re.IGNORECASE):
            start_index = index + 1
    if start_index is None:
        for index, line in enumerate(lines):
            if COURSE_CODE_RE.search(line):
                start_index = index + 1
    if start_index is None or start_index >= len(lines):
        return None
    desc_lines = []
    for line in lines[start_index:]:
        if line in TITLE_EXCLUDE:
            continue
        if COURSE_CODE_RE.search(line):
            continue
        if re.match(r"^(?:APPLIED ARTS|SCIENCE|ADLAI E\. STEVENSON)", line, re.IGNORECASE):
            continue
        desc_lines.append(line)
    description = clean_description(" ".join(desc_lines))
    return description or None


def _infer_credits(section: str, description: Optional[str], code: str, warnings: List[str], page_number: int, title: str) -> float:
    explicit = re.search(r"\bcredits?\s*[:=]\s*(\d+(?:\.\d+)?)", section, re.IGNORECASE)
    if explicit:
        return float(explicit.group(1))
    desc = description or ""
    is_early_bird_code = bool(re.search(r"\d+E\d$", code))
    if is_early_bird_code and re.search(r"1\.5\s*period\s+lab-based", desc, re.IGNORECASE):
        return 1.5
    _infer_credits.inferred_count = getattr(_infer_credits, "inferred_count", 0) + 1
    return 1.0



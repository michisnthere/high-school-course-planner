from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from src.rules.clean_text import clean_description, clean_text, collapse_spaces, split_list_text

NUMBER_WORDS = {
    "one": 1.0,
    "two": 2.0,
    "three": 3.0,
    "four": 4.0,
    "five": 5.0,
    "six": 6.0,
    "seven": 7.0,
    "eight": 8.0,
}

HEADING_LINE_RE = re.compile(r"^([A-Z][A-Z /&-]+?)\s+GRADUATION REQUIREMENT(?:S)?(?:\s+AND\s+WAIVERS)?$", re.IGNORECASE)


def parse_requirement_page(page_number: int, raw_text: str) -> Dict[str, Any]:
    text = clean_text(raw_text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    headings = _find_heading_indices(lines)
    requirements: List[Dict[str, Any]] = []
    warnings: List[str] = []

    if not headings:
        return {
            "sourcePage": page_number,
            "departments": [],
            "courses": [],
            "graduationRequirements": [],
            "warnings": [f"Page {page_number}: no graduation requirement headings found."],
        }

    for position, heading in enumerate(headings):
        end = headings[position + 1]["index"] if position + 1 < len(headings) else len(lines)
        block_lines = lines[heading["endIndex"]:end]
        requirements.append(_parse_requirement_block(page_number, heading["name"], block_lines, warnings))

    return {
        "sourcePage": page_number,
        "departments": [],
        "courses": [],
        "graduationRequirements": requirements,
        "warnings": warnings,
    }


def _find_heading_indices(lines: List[str]) -> List[Dict[str, Any]]:
    headings: List[Dict[str, Any]] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        direct = HEADING_LINE_RE.match(line)
        if direct:
            headings.append({"index": index, "endIndex": index + 1, "name": _normalize_requirement_name(direct.group(1))})
            index += 1
            continue

        if index + 1 < len(lines) and re.match(r"^GRADUATION REQUIREMENT(?:S)?$", lines[index + 1], re.IGNORECASE):
            if _looks_like_requirement_heading_prefix(line):
                headings.append({"index": index, "endIndex": index + 2, "name": _normalize_requirement_name(line)})
                index += 2
                continue

        if index + 1 < len(lines) and re.match(r"^AND WAIVERS$", lines[index + 1], re.IGNORECASE):
            joined = f"{line} {lines[index + 1]}"
            direct = HEADING_LINE_RE.match(joined)
            if direct:
                headings.append({"index": index, "endIndex": index + 2, "name": _normalize_requirement_name(direct.group(1))})
                index += 2
                continue
        index += 1
    return headings


def _looks_like_requirement_heading_prefix(line: str) -> bool:
    letters = re.sub(r"[^A-Za-z]", "", line)
    return bool(letters) and letters.upper() == letters and len(line) <= 80


def _normalize_requirement_name(value: str) -> str:
    cleaned = collapse_spaces(value).replace("/", " / ")
    cleaned = re.sub(r"\s+AND\s+WAIVERS$", "", cleaned, flags=re.IGNORECASE)
    words = []
    for word in cleaned.split():
        if word.upper() in {"ACT", "PE", "CPR", "U.S."}:
            words.append(word.upper())
        elif word == "/":
            words.append(word)
        elif word.lower() in {"and", "or"}:
            words.append(word.lower())
        else:
            words.append(word.capitalize())
    return " ".join(words).replace(" / ", " / ")


def _parse_requirement_block(page_number: int, name: str, block_lines: List[str], warnings: List[str]) -> Dict[str, Any]:
    block = clean_description(" ".join(_strip_footer_lines(block_lines)))
    requirement_type, required_value = _extract_requirement_value(name, block)
    eligible_courses = _extract_eligible_courses(block)
    waiver_rules = _extract_waiver_rules(block_lines, block)

    if required_value is None and any(token in block.lower() for token in ["must complete", "required", "must pass", "participate"]):
        requirement_type = "completion"
    if required_value is None:
        warnings.append(f"Page {page_number} {name}: requirement value not numeric or not explicit.")

    return {
        "name": name,
        "category": "Graduation Requirement",
        "requirementType": requirement_type,
        "requiredValue": required_value,
        "eligibleCourses": eligible_courses,
        "waiverRules": waiver_rules,
        "notes": [block] if block else [],
        "sourceReference": f"Graduation Requirements (page {page_number})",
    }


def _strip_footer_lines(lines: List[str]) -> List[str]:
    return [line for line in lines if not re.match(r"^ADLAI E\. STEVENSON HIGH SCHOOL\d+$", line, re.IGNORECASE)]


def _extract_requirement_value(name: str, block: str) -> tuple[str, Optional[float]]:
    lower_name = name.lower()
    if "driver" in lower_name or "act" in lower_name or "civics" in lower_name or "physical welfare" in lower_name:
        return "completion", None
    if "elective" in lower_name:
        return "credits", 2.0
    if "economics" in lower_name or "personal finance" in lower_name:
        return "completion", None
    if "science" == lower_name:
        return "semesters", 4.0
    if "social studies" in lower_name:
        return "credits", 5.0

    match = re.search(r"\b(\d+(?:\.\d+)?)\s+(semester|semesters|credit|credits)\b", block, re.IGNORECASE)
    if match:
        unit = match.group(2).lower()
        return ("semesters" if unit.startswith("semester") else "credits", float(match.group(1)))
    match = re.search(r"\b(one|two|three|four|five|six|seven|eight)\s+(semester|semesters|credit|credits)\b", block, re.IGNORECASE)
    if match:
        unit = match.group(2).lower()
        return ("semesters" if unit.startswith("semester") else "credits", NUMBER_WORDS[match.group(1).lower()])
    return "completion", None


def _extract_eligible_courses(block: str) -> List[str]:
    match = re.search(r"following courses:\s*(.+?)(?:\.|$)", block, re.IGNORECASE)
    if not match:
        return []
    return split_list_text(match.group(1))


def _extract_waiver_rules(block_lines: List[str], block: str) -> List[str]:
    rules: List[str] = []
    if "waiver" not in block.lower() and "may be satisfied by" not in block.lower():
        return rules
    for line in block_lines:
        stripped = line.strip("- ")
        if not stripped or stripped.upper() == "AND WAIVERS":
            continue
        if line.startswith("-") or "waiver" in stripped.lower() or "may be satisfied by" in stripped.lower():
            rules.append(clean_description(stripped))
    if not rules and "may be satisfied by" in block.lower():
        rules.append(block)
    return rules

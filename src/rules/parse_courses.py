from __future__ import annotations

import re
from dataclasses import dataclass, replace
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


@dataclass
class Block:
    lines: List[str]
    start_index: int
    end_index: int


@dataclass
class CourseUnit:
    title: str
    lines: List[str]
    start_block: int
    end_block: int
    department: Optional[str] = None


@dataclass
class DepartmentContext:
    current_department: Optional[str]


@dataclass
class ExtractionContext:
    """Carries department state forward across pages during a full-book extraction run.

    `prefix_department_map` records which course-code prefixes (e.g. "BUS", "SPA") have been
    empirically observed under a given department name whenever that department was detected
    via an explicit header. This lets a later, header-less continuation page confidently inherit
    the previous page's department ONLY if its course codes match a prefix family already seen
    under that department -- preventing an unrelated new section (e.g. a different course-code
    family) from silently inheriting the wrong department just because it happens to follow it.
    """

    current_department: Optional[str] = None
    prefix_department_map: Dict[str, set] = None

    def __post_init__(self) -> None:
        if self.prefix_department_map is None:
            self.prefix_department_map = {}


def parse_course_page(
    page_number: int,
    raw_text: str,
    classification: str = "detailed_course_content",
    context: Optional[ExtractionContext] = None,
) -> Dict[str, Any]:
    if context is None:
        context = ExtractionContext()
    text = clean_text(raw_text)
    lines = without_footer_lines(text.splitlines())
    blocks = _group_lines_into_blocks(lines)
    departments = _extract_departments(lines, blocks)
    course_units = _segment_course_units(blocks)
    course_units, resolved_department, header_detected = _assign_departments(course_units, blocks, context)
    if resolved_department and (header_detected or resolved_department == context.current_department):
        context.current_department = resolved_department
    if not departments:
        assigned_departments = []
        for unit in course_units:
            if unit.department and unit.department not in assigned_departments:
                assigned_departments.append(unit.department)
        departments = [{"name": name, "description": None} for name in assigned_departments]
    courses: List[Dict[str, Any]] = []
    warnings: List[str] = []
    _infer_credits.inferred_count = 0

    if not course_units:
        return _empty_result(page_number, departments, [f"No course boundaries found on page {page_number}."])

    for unit in course_units:
        course = _parse_course_section(page_number, unit.lines, unit.department, warnings)
        if course:
            _normalize_course_record(course, unit)
            courses.append(course)
            if not course.get("department"):
                warnings.append(
                    f"Page {page_number}: Missing department context for course '{course['title']}' "
                    f"(no header detected, no compatible carry-forward department, no course-code fallback match)."
                )
        else:
            preview = collapse_spaces(" ".join(unit.lines))[:160]
            warnings.append(f"Page {page_number}: failed to parse possible course section: {preview}")

    inferred = getattr(_infer_credits, "inferred_count", 0)
    if inferred:
        warnings.append(f"Page {page_number}: credit inference count = {inferred}")
    departments = _normalize_department_records(departments, courses)
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


def _group_lines_into_blocks(lines: List[str]) -> List[Block]:
    blocks: List[Block] = []
    start_index: Optional[int] = None
    current: List[str] = []

    for index, line in enumerate(lines):
        if start_index is None:
            start_index = index
        elif _starts_strong_block(lines, index):
            blocks.append(Block(lines=current, start_index=start_index, end_index=index))
            start_index = index
            current = []
        current.append(line)

    if start_index is not None and current:
        blocks.append(Block(lines=current, start_index=start_index, end_index=len(lines)))
    return blocks


def _starts_strong_block(lines: List[str], index: int) -> bool:
    line = lines[index]
    lookahead = " ".join(lines[index + 1:index + 6])

    if not _looks_like_course_title_candidate(line):
        return False

    has_codes = COURSE_CODE_RE.search(lookahead) is not None
    has_metadata = METADATA_RE.search(lookahead) is not None

    # CORE RULE: must have course codes nearby
    if not has_codes:
        return False

    # OPTIONAL BOOST: metadata increases confidence but is NOT required
    return True

def _extract_departments(lines: List[str], blocks: Optional[List[Block]] = None) -> List[Dict[str, Optional[str]]]:
    blocks = blocks if blocks is not None else _group_lines_into_blocks(lines)
    department_name = _infer_page_context_department(blocks)
    if not department_name:
        return []
    first_course_block = next((block for block in blocks if _is_course_block_candidate(block)), None)
    description_parts: List[str] = []
    for block in blocks[:2]:
        if block is first_course_block:
            break
        if title_from_heading(re.sub(r"\s+\d+$", "", block.lines[0])) == department_name:
            continue
        for line in block.lines:
            if METADATA_RE.search(line) or COURSE_CODE_RE.search(line):
                break
            description_parts.append(line)
    description = clean_description(" ".join(description_parts)) if description_parts else None
    return [{"name": department_name, "description": description}]


def _infer_page_context_department(blocks: List[Block]) -> Optional[str]:
    for block in blocks[:2]:
        first = block.lines[0] if block.lines else ""
        # A lone single-line block is sometimes a department header with the page
        # number glued directly onto the last word (e.g. "FINE ARTS\u2014MEDIA ARTS48"),
        # which can falsely match COURSE_CODE_RE (e.g. "ARTS48" looks like a course
        # code). Check the header pattern on the digit-stripped text first so a real
        # header isn't discarded as a course-code block before we even look at it.
        if len(block.lines) == 1:
            stripped_first = re.sub(r"\d+$", "", first).strip()
            if _looks_like_department_line(stripped_first):
                return title_from_heading(stripped_first)
        if _is_course_block_candidate(block):
            return None
        if _looks_like_department_line(first):
            return title_from_heading(re.sub(r"\s+\d+$", "", first))
    return None


def _is_course_block_candidate(block: Block) -> bool:
    block_text = " ".join(block.lines)
    return bool(COURSE_CODE_RE.search(block_text))


def _assign_departments(
    course_units: List[CourseUnit],
    blocks: List[Block],
    context: ExtractionContext,
) -> tuple[List[CourseUnit], Optional[str], bool]:
    detected = _infer_page_context_department(blocks)
    if detected is not None:
        _record_prefixes(context, course_units, detected)
        return [replace(unit, department=detected) for unit in course_units], detected, True

    prefixes = _collect_prefixes(course_units)
    carried = context.current_department
    if carried and prefixes:
        known_prefixes = context.prefix_department_map.get(carried)
        # Only inherit the carried-forward department if either (a) we've previously seen this
        # exact prefix family confirmed under that department via a real header, or (b) we have
        # no recorded prefix history for it at all (e.g. it was itself inherited). If we DO have
        # recorded history and this page's prefixes don't match it, this is very likely a new,
        # unlabeled section rather than a continuation -- do not silently mislabel it.
        if known_prefixes is None or prefixes <= known_prefixes:
            _record_prefixes(context, course_units, carried)
            return [replace(unit, department=carried) for unit in course_units], carried, False

    inferred = _infer_department_from_course_units(course_units)
    if inferred:
        return [replace(unit, department=inferred) for unit in course_units], inferred, False

    return [replace(unit, department=None) for unit in course_units], None, False


def _collect_prefixes(course_units: List[CourseUnit]) -> set:
    prefixes = set()
    for unit in course_units:
        for code in COURSE_CODE_RE.findall(" ".join(unit.lines)):
            prefix_match = re.match(r"[A-Z]+", code)
            if prefix_match:
                prefixes.add(prefix_match.group(0))
    return prefixes


def _record_prefixes(context: ExtractionContext, course_units: List[CourseUnit], department: str) -> None:
    prefixes = _collect_prefixes(course_units)
    if not prefixes:
        return
    existing = context.prefix_department_map.setdefault(department, set())
    existing.update(prefixes)


def _infer_department_from_course_units(course_units: List[CourseUnit]) -> Optional[str]:
    prefixes = _collect_prefixes(course_units)
    if not prefixes:
        return None
    if prefixes <= {"ART", "DNC", "MUS", "THR"}:
        return "Fine Arts"
    if prefixes <= {"FRE", "GRE", "HBR", "LAT", "CHI", "SPA"}:
        return "Language Learning"
    if prefixes <= {"SCI"}:
        return "Science"
    if prefixes <= {"SOC"}:
        return "Social Studies"
    if prefixes <= {"MTH"}:
        return "Mathematics"
    if prefixes <= {"ENG", "JRN"}:
        return "Communication Arts"
    if prefixes <= {"PED"}:
        return "Physical Welfare"
    if prefixes <= {"CSC", "TEC"}:
        return "Computer Science, Engineering and Technology (CSET)"
    if prefixes <= {"FCS", "VOC"}:
        return "Applied Arts"
    return None


def _segment_course_units(blocks: List[Block]) -> List[CourseUnit]:
    entries = [
        (block_index, line)
        for block_index, block in enumerate(blocks)
        for line in block.lines
    ]
    starts: List[int] = []
    for index, (_block_index, line) in enumerate(entries):
        if _looks_like_course_unit_title_candidate(line) and _lookahead_supports_course_title(entries, index):
            starts.append(index)
            continue
        if starts and CODE_WITH_SEMESTER_RE.search(line):
            current_text = " ".join(item[1] for item in entries[starts[-1]:index])
            previous_line = _previous_meaningful_line(entries, index)
            fallback = entries[starts[-1]][1]
            derived_title = _derive_title_for_code_unit([line] + [item[1] for item in entries[index + 1:index + 8]], fallback)
            if (
                METADATA_RE.search(current_text)
                and not _looks_like_course_unit_title_candidate(previous_line)
                and derived_title != fallback
            ):
                starts.append(index)

    units: List[CourseUnit] = []
    for position, start in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else len(entries)
        segment = entries[start:end]
        if not segment:
            continue
        first_block = segment[0][0]
        last_block = segment[-1][0] + 1
        segment_lines = [line for _block_index, line in segment]
        first_line = segment_lines[0]
        if _looks_like_course_unit_title_candidate(first_line):
            title = first_line
            unit_lines = segment_lines
        else:
            fallback = units[-1].title if units else first_line
            title = _derive_title_for_code_unit(segment_lines, fallback)
            unit_lines = [title] + segment_lines
        units.append(CourseUnit(title=title, lines=unit_lines, start_block=first_block, end_block=last_block))
    return units


def _lookahead_supports_course_title(entries: List[tuple[int, str]], index: int) -> bool:
    has_code = False
    has_metadata = False
    for _block_index, line in entries[index + 1:index + 6]:
        if not has_code and _looks_like_course_unit_title_candidate(line):
            return False
        has_code = has_code or bool(COURSE_CODE_RE.search(line))
        has_metadata = has_metadata or bool(METADATA_RE.search(line))
    return has_code and has_metadata


def _previous_meaningful_line(entries: List[tuple[int, str]], index: int) -> str:
    for _block_index, line in reversed(entries[:index]):
        if line in TITLE_EXCLUDE:
            continue
        if METADATA_RE.search(line):
            continue
        if COURSE_CODE_RE.search(line):
            continue
        return line
    return ""


def _derive_title_for_code_unit(lines: List[str], fallback: str) -> str:
    code_line = lines[0] if lines else ""
    codes = [match.group("code") for match in CODE_WITH_SEMESTER_RE.finditer(code_line)]
    if codes:
        code_patterns = [re.escape(code) for code in codes]
        if len(codes) >= 2:
            prefix_match = re.match(r"([A-Z]+)(\d+)", codes[1])
            if prefix_match:
                code_patterns.append(re.escape(f"{codes[0]}/{prefix_match.group(2)}"))
        code_pattern = "|".join(code_patterns)
        for line in lines[1:8]:
            match = re.search(rf"\b([A-Z][A-Za-z0-9\s/]+?)\s*\((?:{code_pattern})\)", line)
            if match:
                return match.group(1).strip()
    return fallback


def _looks_like_course_unit_title_candidate(line: str) -> bool:
    stripped = collapse_spaces(line)
    if stripped.startswith("DUAL CREDIT"):
        return False
    if stripped in TITLE_EXCLUDE:
        return False
    if stripped in {"LAKE COUNTY", "COLLEGE OF", "AND TECHNOLOGY"}:
        return False
    if len(stripped) < 3 or len(stripped) > 90:
        return False
    if len(stripped.split()) > 9:
        return False
    if stripped.endswith(" COURSE OFFERINGS"):
        return False
    if METADATA_RE.search(stripped) or COURSE_CODE_RE.search(stripped):
        return False
    letters = re.sub(r"[^A-Za-z]", "", stripped)
    if not letters:
        return False
    return letters.upper() == letters


def _looks_like_department_line(line: str) -> bool:
    stripped = line.strip()
    if len(stripped) < 4 or len(stripped) > 90:
        return False
    if COURSE_CODE_RE.search(stripped):
        return False
    letters = re.sub(r"[^A-Za-z]", "", stripped)
    return bool(letters) and letters.upper() == letters


def _find_course_title_spans(blocks: List[Block]) -> List[int]:
    spans: List[int] = []
    for block in blocks:
        if not _is_course_block_candidate(block):
            continue
        index = block.start_index
        line = block.lines[0]
        if not _looks_like_course_title_candidate(line):
            continue
        lookahead = " ".join(block.lines[1:6])
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


def _normalize_course_record(course: Dict[str, Any], unit: CourseUnit) -> None:
    course["title"] = _normalize_course_title(_reconstruct_course_title(course["title"], unit))
    course["department"] = _normalize_department_name(course.get("department"))
    course["isOnline"] = _is_online_course(course["title"], unit.lines)


def _normalize_department_records(departments: List[Dict[str, Optional[str]]], courses: List[Dict[str, Any]]) -> List[Dict[str, Optional[str]]]:
    normalized: List[Dict[str, Optional[str]]] = []
    seen = set()
    for department in departments:
        name = _normalize_department_name(department.get("name"))
        if not name or name in seen:
            continue
        normalized.append({"name": name, "description": department.get("description")})
        seen.add(name)
    for course in courses:
        name = course.get("department")
        if name and name not in seen:
            normalized.append({"name": name, "description": None})
            seen.add(name)
    return normalized


def _normalize_department_name(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    cleaned = _normalize_known_text_artifacts(name)
    cleaned = re.sub(r"\d+$", "", cleaned).strip()
    known = {
        "Family and": "Family and Consumer Sciences",
        "American Studies (ap U.S. History and": "Social Studies",
        "Computer Science, Engineering and Technology (cset)": "Computer Science, Engineering and Technology (CSET)",
        "Fine Arts—theatre": "Fine Arts—Theatre",
        "Fine Arts—visual Arts": "Fine Arts—Visual Arts",
        "Fine Arts—media Arts": "Fine Arts—Media Arts",
        "Fine Arts—dance": "Fine Arts—Dance",
        "Fine Arts—music": "Fine Arts—Music",
        "Language Learning—spanish": "Language Learning—Spanish",
    }
    return known.get(cleaned, cleaned)


def _normalize_course_title(title: str) -> str:
    cleaned = _normalize_known_text_artifacts(title)
    replacements = {
        "AP Art: Drawing, 2D and 3D Design": "AP Art: Drawing, 2D and 3D Design",
        "2D Animation": "2D Animation",
        "3D Animation": "3D Animation",
    }
    return replacements.get(cleaned, cleaned)


def _normalize_known_text_artifacts(value: str) -> str:
    replacements = {
        "Cul Ture": "Culture",
        "Al Ternative": "Alternative",
        "Heal Th": "Health",
        "Mul Tivariable": "Multivariable",
        "Mul Tilingual": "Multilingual",
        "P .e.": "P.E.",
        "2d": "2D",
        "3d": "3D",
    }
    cleaned = value
    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)
    cleaned = re.sub(r"\bAb/bc\b", "AB/BC", cleaned)
    cleaned = re.sub(r"\bAb\b(?=/BC|\b)", "AB", cleaned)
    cleaned = re.sub(r"\bBc\b", "BC", cleaned)
    cleaned = cleaned.replace("(cset)", "(CSET)")
    return collapse_spaces(cleaned)


def _reconstruct_course_title(title: str, unit: CourseUnit) -> str:
    codes = [match.group("code") for match in CODE_WITH_SEMESTER_RE.finditer("\n".join(unit.lines))]
    code_set = set(codes)
    if {"THR301", "THR302"} & code_set:
        return "Theatre Leadership: Directing and Management"
    if {"SOC63Q1", "SOC63Q2"} & code_set:
        return "AP Comparative Government and Politics—Online"
    if {"ELD261", "ELD262"} & code_set:
        return "English Language Development (ELD) 2"
    if {"ELD361", "ELD362"} & code_set:
        return "English Language Development (ELD) Language"
    if {"ELD371", "ELD372"} & code_set:
        return "English Language Development (ELD) Literature"
    return title


def _is_online_course(title: str, lines: List[str]) -> bool:
    text = "\n".join([title] + lines)
    return bool(re.search(r"\b(?:Online|Virtual)\b", text, re.IGNORECASE))


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

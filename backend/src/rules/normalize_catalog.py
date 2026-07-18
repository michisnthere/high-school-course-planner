from __future__ import annotations

import copy
import re
from typing import Any, Dict, List, Optional, Tuple

from src.rules.clean_text import clean_text

PAGE_NUMBER_RE = re.compile(r"(.*?)(\d+)$")
DASH_SPLIT_RE = re.compile(r"\s*[–—]\s*")

TEXT_REPLACEMENTS = {
    "Cul Ture": "Culture",
    "Al Ternative": "Alternative",
    "Heal Th": "Health",
    "Mul Tivariable": "Multivariable",
    "Mul Tilingual": "Multilingual",
    "P .e.": "P.E.",
    "2d": "2D",
    "3d": "3D",
}

KNOWN_DEPARTMENT_FIXES = {
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


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = clean_text(value)
    for old, new in TEXT_REPLACEMENTS.items():
        cleaned = cleaned.replace(old, new)
    cleaned = re.sub(r"\bAb/bc\b", "AB/BC", cleaned)
    cleaned = re.sub(r"\bAb\b(?=/BC|\b)", "AB", cleaned)
    cleaned = re.sub(r"\bBc\b", "BC", cleaned)
    cleaned = cleaned.replace("(cset)", "(CSET)")
    return re.sub(r"\s+", " ", cleaned).strip()


def normalize_department_name(dept: Optional[str]) -> Optional[str]:
    if not dept:
        return None
    raw = normalize_text(dept.strip())
    if not raw:
        return None
    raw = PAGE_NUMBER_RE.sub(r"\1", raw).strip()
    return KNOWN_DEPARTMENT_FIXES.get(raw, raw)


def split_department(dept: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    normalized = normalize_department_name(dept)
    if not normalized:
        return None, None, None

    parts = DASH_SPLIT_RE.split(normalized, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip(), normalized

    return normalized, None, normalized


def _normalize_text_list(items: Optional[List[Any]]) -> Optional[List[str]]:
    if not items:
        return items
    result = []
    for item in items:
        if isinstance(item, str):
            result.append(normalize_text(item) or "")
        else:
            result.append(item)
    return result


def normalize_course(course: Dict[str, Any], db_ready: bool = False) -> Dict[str, Any]:
    normalized = copy.deepcopy(course)
    normalized["title"] = normalize_text(normalized.get("title")) or ""
    normalized["department"] = normalize_department_name(normalized.get("department"))
    normalized["description"] = normalize_text(normalized.get("description"))
    normalized["isOnline"] = bool(normalized.get("isOnline", False))
    normalized["notes"] = _normalize_text_list(normalized.get("notes"))

    for offering in normalized.get("offerings", []):
        offering["prerequisites"] = _normalize_text_list(offering.get("prerequisites"))
        off_notes = _normalize_text_list(offering.get("notes"))
        if off_notes is not None:
            offering["notes"] = off_notes
        for key in ("semesterLabel", "duration", "courseCode"):
            val = offering.get(key)
            if isinstance(val, str):
                offering[key] = normalize_text(val) or val

    for choice in normalized.get("choices", []):
        choice["name"] = normalize_text(choice.get("name")) or choice.get("name", "")
        choice["notes"] = _normalize_text_list(choice.get("notes"))

    if db_ready:
        dept, subdept, raw = split_department(course.get("department"))
        normalized["department"] = dept
        normalized["subdepartment"] = subdept
        normalized["department_raw"] = raw

    return normalized


def normalize_catalog(courses: List[Dict[str, Any]], db_ready: bool = False) -> List[Dict[str, Any]]:
    return [normalize_course(course, db_ready=db_ready) for course in courses]


def normalize_departments(departments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    seen = set()
    for department in departments:
        name = normalize_department_name(department.get("name"))
        if not name or name in seen:
            continue
        normalized.append({
            **department,
            "name": name,
            "description": normalize_text(department.get("description")),
            "director": normalize_text(department.get("director")),
            "directorEmail": normalize_text(department.get("directorEmail")),
            "directorPhone": normalize_text(department.get("directorPhone")),
        })
        seen.add(name)
    return normalized

import re
from typing import Any, Dict

COURSE_PATTERNS = {
    "course_code": re.compile(r"\b[A-Z]{2,5}\d{3}\b"),
    "open_to": re.compile(r"\bOPEN\s+TO\s*:\b", re.IGNORECASE),
    "prerequisite": re.compile(r"\bPREREQUISITE\s*:\b", re.IGNORECASE),
    "credit": re.compile(r"\bCREDIT\s*:\b", re.IGNORECASE),
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

MIN_POLICY_SIGNAL_COUNT = 2
MIN_CHARACTER_COUNT = 250


def classify_page(text: str) -> Dict[str, Any]:
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
    is_academic_policy_content = policy_score >= MIN_POLICY_SIGNAL_COUNT
    should_extract = is_detailed_course_content or is_academic_policy_content

    if is_detailed_course_content:
        classification = "detailed_course_content"
    elif is_course_listing_summary:
        classification = "course_listing_summary"
    elif is_academic_policy_content:
        classification = "academic_policy_content"
    elif len(normalized) < MIN_CHARACTER_COUNT:
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

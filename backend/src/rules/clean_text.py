from __future__ import annotations

import re
from typing import Iterable, List, Optional

MOJIBAKE_REPLACEMENTS = {
    "\u00e2\u20ac\u2122": "'",
    "\u00e2\u20ac\u02dc": "'",
    "\u00e2\u20ac\u0153": '"',
    "\u00e2\u20ac\u009d": '"',
    "\u00e2\u20ac\u201d": "-",
    "\u00e2\u20ac\u201c": "-",
    "\u00e2\u2013\u00a0": "-",
    "â€™": "'",
    "â€˜": "'",
    "â€œ": '"',
    "â€": '"',
    "â€“": "-",
    "â€”": "-",
    "â€¦": "...",
    "â– ": "-",
    "ï¬€": "ff",
    "ï¬": "fi",
    "\ufb00": "ff",
    "\ufb01": "fi",
}

OCR_WORD_FIXES = {
    "so/f_tware": "software",
    "eï¬€ectively": "effectively",
    "eï¬€icient": "efficient",
    "diï¬€erent": "different",
}

CREDIT_TYPE_OVERRIDES = {
    "college prep": "College Prep",
    "honors": "Honors",
    "accelerated": "Accelerated",
    "honors physical science": "Honors Physical Science",
    "honors biological science": "Honors Biological Science",
    "honors (dual credit) physical science": "Honors (Dual Credit) Physical Science",
}

ACRONYMS = {"AP", "ACT", "CPR", "STEM", "CNC", "CAD", "CEO", "CFO", "U.S.", "US"}


def clean_text(text: str) -> str:
    cleaned = text
    for old, new in MOJIBAKE_REPLACEMENTS.items():
        cleaned = cleaned.replace(old, new)
    for old, new in OCR_WORD_FIXES.items():
        cleaned = cleaned.replace(old, new)
    cleaned = cleaned.replace("collabora-\ntively", "collaboratively")
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    return cleaned


def collapse_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def clean_description(text: str) -> str:
    text = clean_text(text)
    text = re.sub(r"\s*-\s*\n\s*", "", text)
    return collapse_spaces(text)


def normalize_credit_type(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = collapse_spaces(clean_text(value)).strip(" .")
    override = CREDIT_TYPE_OVERRIDES.get(cleaned.lower())
    if override:
        return override
    words = []
    for word in cleaned.split():
        stripped = word.strip("()")
        if stripped.upper() in ACRONYMS:
            words.append(word.upper())
        elif word.startswith("(") and word.endswith(")"):
            words.append(f"({stripped.capitalize()})")
        else:
            words.append(word.capitalize())
    return " ".join(words)


def title_from_heading(value: str) -> str:
    cleaned = collapse_spaces(clean_text(value)).strip(" -")
    pieces = []
    for word in cleaned.split():
        if word.upper() in ACRONYMS:
            pieces.append(word.upper())
        elif re.fullmatch(r"[IVX]+", word):
            pieces.append(word)
        elif re.fullmatch(r"\d+", word):
            pieces.append(word)
        elif word.lower() in {"and", "or", "to"}:
            pieces.append(word.lower())
        else:
            pieces.append(word.capitalize())
    return " ".join(pieces)


def parse_grade_levels(value: str) -> List[int]:
    grades: List[int] = []
    for number in re.findall(r"\b(?:9|10|11|12)\b", value):
        grade = int(number)
        if grade not in grades:
            grades.append(grade)
    return grades


def split_list_text(value: str) -> List[str]:
    cleaned = clean_description(value)
    if not cleaned or cleaned.lower() in {"none", "none."}:
        return []
    parts = re.split(r"\s*(?:;|,\s+or\s+|\s+or\s+)\s*", cleaned)
    parts = [part.strip(" .") for part in parts if part.strip(" .")]
    return parts or [cleaned]


def without_footer_lines(lines: Iterable[str]) -> List[str]:
    result: List[str] = []
    footer_pattern = re.compile(r"^(?:ADLAI E\. STEVENSON HIGH SCHOOL|SCIENCE|APPLIED ARTS|FINE ARTS|WORLD LANGUAGES|ENGLISH|MATHEMATICS|SOCIAL STUDIES)(?![\u2013\u2014]).{0,80}\d+$", re.IGNORECASE)
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if footer_pattern.match(stripped):
            continue
        if re.match(r"^WWW\.D125\.ORG/ACADEMICS/COURSEBOOK", stripped, re.IGNORECASE):
            continue
        result.append(stripped)
    return result

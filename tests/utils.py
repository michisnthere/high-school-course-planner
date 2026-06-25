from __future__ import annotations

from src.rules.parse_courses import parse_course_page


def run_extraction(page_text: str):
    """
    Runs the full parser for a single page.
    Keep this as the only integration point for extraction tests.
    """
    return parse_course_page(0, page_text)

from __future__ import annotations

from pathlib import Path

from src.rules.parse_courses import ExtractionContext, parse_course_page
from tests.utils import run_extraction


FIXTURE_DIR = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")


def test_page_102_regression():
    text = load_fixture("page_102.txt")
    result = run_extraction(text)

    departments = result["departments"]
    courses = result["courses"]

    assert departments == [{"name": "Social Studies", "description": None}]
    assert all(department["name"] != "AP Government–united States" for department in departments)
    assert any("AP Government" in course["title"] for course in courses), courses
    assert len(courses) >= 1


def test_page_91_course_count():
    text = load_fixture("page_91.txt")
    result = run_extraction(text)

    courses = result["courses"]

    assert 6 <= len(courses) <= 8, f"Unexpected count: {len(courses)}"


def test_page_49_no_collapse():
    text = load_fixture("page_49.txt")
    result = run_extraction(text)

    courses = result["courses"]

    assert len(courses) == 4, f"Unexpected count: {len(courses)}"


def test_page_68_no_collapse():
    text = load_fixture("page_68.txt")
    result = run_extraction(text)

    courses = result["courses"]

    assert len(courses) == 2, f"Unexpected count: {len(courses)}"


def test_page_102_department_context_and_stable_course():
    text = load_fixture("page_102.txt")
    result = run_extraction(text)

    assert result["departments"] == [{"name": "Social Studies", "description": None}]
    assert len(result["courses"]) > 0


def test_department_context_carries_forward_across_headerless_continuation_page():
    """A page with no department header, but the same course-code prefix family
    already confirmed under the previous page's department, should inherit it."""
    context = ExtractionContext()

    page_19 = load_fixture("page_19_bus_header.txt")
    result_19 = parse_course_page(19, page_19, context=context)
    assert result_19["courses"][0]["department"] == "Applied Arts–business Education"

    page_20 = load_fixture("page_20_bus_continuation.txt")
    result_20 = parse_course_page(20, page_20, context=context)
    assert result_20["courses"][0]["title"] == "Personal Finance"
    assert result_20["courses"][0]["department"] == "Applied Arts–business Education"
    assert not any("Missing department context" in warning for warning in result_20["warnings"])


def test_department_context_does_not_leak_into_unrelated_new_section():
    """A genuinely new, unlabeled section (different course-code prefix family) must NOT
    silently inherit the previous page's department just because it follows it."""
    context = ExtractionContext()

    page_81 = load_fixture("page_81_spanish_header.txt")
    result_81 = parse_course_page(81, page_81, context=context)
    assert result_81["courses"][0]["department"] == "Language Learning–spanish"

    page_82 = load_fixture("page_82_eld_new_section.txt")
    result_82 = parse_course_page(82, page_82, context=context)
    assert result_82["courses"][0]["department"] != "Language Learning–spanish"
    assert any("Missing department context" in warning for warning in result_82["warnings"])

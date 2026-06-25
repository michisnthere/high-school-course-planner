from __future__ import annotations

from pathlib import Path

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

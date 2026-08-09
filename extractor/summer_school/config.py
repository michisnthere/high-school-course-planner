"""Path and constant configuration for the Summer School extraction framework.

All generated artifacts (rendered pages, per-page JSON, combined catalogs, and
reports) are written under ``extractor/summer_school/output/`` which is
git-ignored.  No database is ever touched by this package.
"""
from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
EXTRACTOR_DIR = PACKAGE_DIR.parent
PROJECT_ROOT = EXTRACTOR_DIR.parent

# ---------------------------------------------------------------------------
# Source coursebook
# ---------------------------------------------------------------------------

SOURCE_PDF_NAME = "SummerSchool2627.pdf"
SOURCE_PDF = EXTRACTOR_DIR / SOURCE_PDF_NAME

SOURCE_TITLE = "Summer School Coursebook 2026-2027"

# ---------------------------------------------------------------------------
# Output locations (all git-ignored generated artifacts)
# ---------------------------------------------------------------------------

OUTPUT_DIR = PACKAGE_DIR / "output"
PAGES_DIR = OUTPUT_DIR / "pages"          # deterministic PNG rendering
EXTRACT_DIR = OUTPUT_DIR / "extract"      # one JSON per page
COMBINED_DIR = OUTPUT_DIR / "combined"    # combined + validated catalogs

COMBINED_CATALOG = COMBINED_DIR / "summer-school-catalog.json"
VALIDATED_CATALOG = COMBINED_DIR / "summer-school-validated.json"
READY_CATALOG = COMBINED_DIR / "summer-school-ready.json"
VALIDATION_REPORT = COMBINED_DIR / "validation-report.json"

# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

DEFAULT_DPI = 300
# Deterministic, page-numbered filenames (matches extractor/page_renderer.py).
PAGE_FILENAME_TEMPLATE = "page_{page:03d}.png"

# ---------------------------------------------------------------------------
# Summer School session representation
#
# The planner models Summer School on its own pair of semester codes:
#   planner semester 3  == Summer School Session 1 (SUMMER_SEMESTER)
#   planner semester 4  == Summer School Session 2 (SUMMER_SEMESTER_2)
# A course is offered in exactly one session (a "one-session" course) or in
# both sessions (a "full_summer" course that occupies both semesters, the same
# way a full-year regular course occupies S1 + S2).
# ---------------------------------------------------------------------------

SUMMER_SESSION_1 = "Session 1"
SUMMER_SESSION_2 = "Session 2"
SUMMER_SESSIONS = (SUMMER_SESSION_1, SUMMER_SESSION_2)

# Maps a catalog session token to the planner semester code used for it.
SESSION_TO_PLANNER_SEMESTER = {
    SUMMER_SESSION_1: 3,
    SUMMER_SESSION_2: 4,
}

DURATION_ONE_SESSION = "one_session"
DURATION_FULL_SUMMER = "full_summer"
SUMMER_DURATIONS = (DURATION_ONE_SESSION, DURATION_FULL_SUMMER)

# ---------------------------------------------------------------------------
# Regular catalog used for matching
# ---------------------------------------------------------------------------

REGULAR_CATALOG = PROJECT_ROOT / "backend" / "data" / "academic_data.json"
GRADUATION_REQUIREMENTS_SOURCE = (
    EXTRACTOR_DIR / "section_output" / "graduation_requirements.json"
)

# ---------------------------------------------------------------------------
# Known graduation requirement names (referential checks)
# ---------------------------------------------------------------------------

MEASURABLE_REQUIREMENT_NAMES = {
    "English",
    "Mathematics",
    "Science",
    "Biology",
    "Physical Science",
    "Health",
    "Economics or Personal Finance",
    "Driver Education",
    "Fine Arts",
    "Electives",
    "Physical Education",
    "Social Studies",
    "U.S. History",
    "World History and Geography",
    "Government",
    "Additional Credits and P.E.",
    "Total Credits",
}
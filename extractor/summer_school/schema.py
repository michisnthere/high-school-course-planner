"""Documented Summer School catalog JSON schema.

This module defines -- and documents -- the exact JSON shape produced by the
Summer School extraction framework and consumed by the validation, matching,
and dry-run import stages.

Principles
----------
* The schema is layered:

    PDF
      -> PNG pages
      -> per-page extraction result (sourcePage preserved)
      -> combined Summer School catalog
      -> validated catalog
      -> matched ("ready") catalog

* Extraction NEVER writes to the database.  The "ready" catalog is the last
  file produced by extraction; a database import consumes it in a later stage.

* No field is invented.  A field that cannot be read from the coursebook page
  is left unset (``None`` / omitted) and recorded in ``extractionIssues`` with
  ``status: "unclear"`` instead of being guessed.

* A Summer School course can be:
    1. a course that clearly corresponds to an existing regular catalog course
       (``regularCourseMatch.status == "matched"``), or
    2. a Summer-School-only course (``isSummerOnly == true``,
       ``regularCourseMatch.unresolved`` when no confident match exists).
  Unresolved cases are reported, never auto-created.

Mappings to the existing regular model
--------------------------------------
* ``session`` maps to the planner Summer School semester codes 3 and 4
  (config.SUMMER_SESSION_1 -> 3, SUMMER_SESSION_2 -> 4).
* ``duration`` uses the planner convention: ``one_session`` (1 semester) or
  ``full_summer`` (occupies BOTH Summer School semesters, exactly like a
  full-year regular course).
"""
from __future__ import annotations

from typing import List, Literal, Optional, TypedDict

try:  # Python >= 3.11
    from typing import NotRequired
except ImportError:  # Python 3.8/3.9/3.10: optional-field hints become Optional
    NotRequired = Optional

# ---------------------------------------------------------------------------
# Source reference
# ---------------------------------------------------------------------------


class SourceReference(TypedDict):
    """Where a course was found.  Always preserved from the page that produced it."""

    file: str  # "SummerSchool2627.pdf"
    page: int  # 1-based page number in the PDF


# ---------------------------------------------------------------------------
# Extraction issue (unclear field reporting)
# ---------------------------------------------------------------------------


class ExtractionIssue(TypedDict):
    """A field that could not be confidently read from the page image."""

    course: str  # course title
    page: int  # source page
    field: str  # e.g. "prerequisites", "credits", "gradeLevels"
    status: Literal["unclear", "missing", "conflict"]
    note: NotRequired[Optional[str]]


# ---------------------------------------------------------------------------
# Regular-course relationship
# ---------------------------------------------------------------------------


class SummerCourseMatch(TypedDict):
    """How a Summer School course relates to an existing regular catalog course."""

    status: Literal["matched", "candidate", "unresolved"]
    matchedCourseId: NotRequired[Optional[int]]  # DB Course.id when known
    matchedTitle: NotRequired[Optional[str]]
    matchedCourseCode: NotRequired[Optional[str]]
    confidence: NotRequired[Optional[Literal["high", "medium", "low"]]]
    reason: NotRequired[Optional[str]]


class SummerMeeting(TypedDict):
    """One printed ``COURSECODE: DATES`` + ``TIME`` block in a coursebook listing.

    A course prints one block per course code offered (e.g. ``ART11S: June
    2-June 25`` followed by ``7:45 A.M.-12:50 P.M.``).  Multi-session courses
    therefore carry multiple meetings; a single-session course carries one.
    """

    courseCode: NotRequired[Optional[str]]  # exact printed code block label
    dates: NotRequired[Optional[str]]  # exact printed date span, e.g. "June 2-June 11"
    startTime: NotRequired[Optional[str]]  # printed start time, e.g. "7:45 A.M."
    endTime: NotRequired[Optional[str]]  # printed end time, e.g. "12:50 P.M."


# ---------------------------------------------------------------------------
# Course record
# ---------------------------------------------------------------------------


class SummerCourse(TypedDict):
    """A single course as it appears in the Summer School coursebook."""

    title: str
    # unique key that stays stable across extraction runs for diffing:
    key: str

    description: NotRequired[Optional[str]]
    division: NotRequired[Optional[str]]
    department: NotRequired[Optional[str]]

    # course code exactly as printed in the Summer School coursebook, if any.
    # This may or may not match the regular catalog code for the same course.
    courseCode: NotRequired[Optional[str]]

    credits: NotRequired[Optional[float]]  # numeric, > 0 when present
    # Printed grading/credit type, e.g. "Pass/Fail".  This is NOT a catch-all
    # for flags such as "GPA Waiver Option"; flags go in ``notes``.
    creditType: NotRequired[Optional[str]]
    # Explicit credit status is consumed by the isolated importer.  Non-credit
    # and unknown courses intentionally carry ``credits: null``.
    creditStatus: NotRequired[Optional[Literal["credit", "non-credit", "unknown"]]]
    gradeLevels: NotRequired[Optional[List[int]]]  # 9-12
    # Which Summer School sessions offer this course: one or both of
    # config.SUMMER_SESSION_1 / config.SUMMER_SESSION_2.
    sessions: NotRequired[Optional[List[str]]]
    duration: NotRequired[Optional[Literal["one_session", "full_summer"]]]
    # Printed meeting-length phrase, e.g. "Eight-Day Course", "One-Semester
    # Course", "Four-Day Course".  Left unset for full_summer courses, which
    # print no such phrase.
    durationNote: NotRequired[Optional[str]]
    # Cost exactly as printed (e.g. "$225", "$425/Semester"), if any.
    cost: NotRequired[Optional[str]]
    # One block per printed code:dates:time cluster (see SummerMeeting).
    meetings: NotRequired[Optional[List[SummerMeeting]]]

    prerequisites: NotRequired[Optional[List[str]]]
    corequisites: NotRequired[Optional[List[str]]]

    # Canonical graduation requirement names the course fulfills (as recorded
    # in the coursebook description if it states them explicitly).
    fulfillsRequirements: NotRequired[Optional[List[str]]]
    attributes: NotRequired[Optional[List[str]]]
    # Genuine free-form facts printed on the page that have no dedicated field
    # (e.g. "GPA Waiver Option", "Accelerated Option Available", "Students may
    # register for multiple sessions", delivery/transport caveats).  Cost,
    # dates, times, and printed meeting length live in ``cost`` /
    # ``meetings`` / ``durationNote`` and MUST NOT be duplicated here.
    notes: NotRequired[Optional[List[str]]]

    # Summer-School-only courses have no existing regular Course record.
    # Set by the matching stage; NOT inferred during extraction.
    isSummerOnly: NotRequired[Optional[bool]]

    regularCourseMatch: NotRequired[Optional[SummerCourseMatch]]

    sourceReference: SourceReference

    # Any field the visual extraction could not read confidently.
    extractionIssues: NotRequired[Optional[List[ExtractionIssue]]]


# ---------------------------------------------------------------------------
# Catalog envelope
# ---------------------------------------------------------------------------


class SummerCatalog(TypedDict):
    """Top-level Summer School catalog produced by the combine stage."""

    schemaVersion: str
    source: SourceReference  # file + first page the catalog was extracted from
    generatedAt: NotRequired[Optional[str]]
    courses: List[SummerCourse]
    warnings: List[str]


# ---------------------------------------------------------------------------
# Per-page extraction result (intermediate, before combine)
# ---------------------------------------------------------------------------


class PageExtractionResult(TypedDict):
    """Structured result of vision extraction on a single PNG page."""

    sourceReference: SourceReference  # always `page`-qualified
    courses: List[SummerCourse]
    warnings: List[str]  # human-readable page-level notes


__all__ = [
    "SourceReference",
    "ExtractionIssue",
    "SummerCourseMatch",
    "SummerMeeting",
    "SummerCourse",
    "SummerCatalog",
    "PageExtractionResult",
]

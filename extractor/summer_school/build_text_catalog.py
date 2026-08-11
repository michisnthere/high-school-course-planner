"""Build the Summer School catalog from the PDF text layer.

The Summer 2026 coursebook has a reliable text layer.  This extractor keeps the
source data intentionally small and conservative: it records only course facts
that are visibly printed in the coursebook and leaves descriptions/uncertain
equivalences to later review.  It is useful when the optional vision provider is
not configured, and it still produces the same annotated ready-catalog shape
consumed by the isolated database importer.

This is not a replacement for the vision pipeline.  If the PDF text layer is
changed or a future coursebook has a different layout, use the normal
render/extract/combine stages instead of copying this catalog forward.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from . import catalog_matching
from . import combine
from . import config
from . import validate


def _key(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def _course(
    *,
    title: str,
    page: int,
    code: str,
    credits: Optional[float],
    grades: List[int],
    sessions: List[str],
    duration: str = "one_session",
    prerequisites: Optional[List[str]] = None,
    fulfills: Optional[List[str]] = None,
    credit_status: Optional[str] = None,
    notes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    status = credit_status or ("credit" if credits is not None else "non-credit")
    record: Dict[str, Any] = {
        "title": title,
        "key": _key(title),
        "courseCode": code,
        "creditStatus": status,
        "credits": credits,
        "gradeLevels": grades,
        "sessions": sessions,
        "duration": duration,
        "prerequisites": prerequisites or [],
        "corequisites": [],
        "fulfillsRequirements": fulfills or [],
        "sourceReference": {"file": config.SOURCE_PDF_NAME, "page": page},
        "extractionIssues": [],
    }
    if notes:
        record["notes"] = notes
    return record


def source_courses() -> List[Dict[str, Any]]:
    """Facts transcribed from coursebook pages 8–19 only."""

    either = [config.SUMMER_SESSION_1, config.SUMMER_SESSION_2]
    first = [config.SUMMER_SESSION_1]
    second = [config.SUMMER_SESSION_2]
    all_grades = [9, 10, 11, 12]

    return [
        # Applied Arts / Business Education
        _course(
            title="Driver Education",
            page=8,
            code="D/E21S/D/E22S",
            credits=1,
            grades=[10, 11, 12],
            sessions=either,
            fulfills=["Driver Education"],
            prerequisites=[
                "Age 15 before the first day of summer school",
                "parental consent",
                "an instruction permit issued by the Secretary of State's office",
                "at least eight (8) credits in the previous two semesters",
                "students in the ELD program must have completed ELD 2",
            ],
        ),
        _course(
            title="Introduction to Business",
            page=8,
            code="BUS71S/BUS72S",
            credits=1,
            grades=all_grades,
            sessions=either,
        ),
        _course(
            title="Business Applications and Technology 1",
            page=8,
            code="BUS12S",
            credits=1,
            grades=all_grades,
            sessions=second,
        ),
        # Career Exploration
        _course(
            title="Careers in Business",
            page=9,
            code="CAR53S",
            credits=0.5,
            grades=[10, 11, 12],
            sessions=first,
        ),
        _course(
            title="Careers in Law",
            page=9,
            code="CAR35S",
            credits=0.5,
            grades=[10, 11, 12],
            sessions=first,
        ),
        _course(
            title="Careers in Healthcare and Medicine",
            page=9,
            code="CAR31S/CAR33S",
            credits=0.5,
            grades=[10, 11, 12],
            sessions=first,
        ),
        _course(
            title="Careers in STEM",
            page=9,
            code="CAR62S",
            credits=0.5,
            grades=[10, 11, 12],
            sessions=second,
        ),
        # Communication Arts
        _course(
            title="College Essay Workshop",
            page=10,
            code="ENG51S/ENG53S/ENG55S/ENG54S/ENG56S",
            credits=None,
            grades=[11, 12],
            sessions=either,
            notes=["Students may register for multiple sessions."],
        ),
        _course(
            title="Creative Writing",
            page=10,
            code="ENG57S",
            credits=1,
            grades=[11, 12],
            sessions=first,
            fulfills=["English"],
        ),
        _course(
            title="English Failure Credit Recovery",
            page=10,
            code="ENG25S",
            credits=1,
            grades=[10, 11, 12],
            sessions=first,
            fulfills=["English"],
            prerequisites=["prior enrollment in Freshman, Sophomore, Junior and/or Senior English"],
        ),
        _course(
            title="Reading for College",
            page=10,
            code="ENG71S",
            credits=1,
            grades=[10, 11, 12],
            sessions=first,
        ),
        # Computer Science
        _course(
            title="Computer Programming 1",
            page=11,
            code="CSC61S",
            credits=1,
            grades=all_grades,
            sessions=first,
        ),
        _course(
            title="Computer Programming 2",
            page=11,
            code="CSC82S",
            credits=1,
            grades=all_grades,
            sessions=second,
            prerequisites=[
                "Computer Programming 1 (CSC161/162)",
                "Web Development 2 (TEC281/282)",
                "Principles of Engineering (TEC301/302)",
                "AP Computer Science Principles (CSC371/372)",
            ],
        ),
        # Fine Arts
        _course(
            title="Art and Design",
            page=12,
            code="ART11S/ART12S",
            credits=1,
            grades=all_grades,
            sessions=either,
        ),
        _course(
            title="Photography 1",
            page=12,
            code="ART31S/ART32S",
            credits=1,
            grades=all_grades,
            sessions=either,
        ),
        _course(
            title="Digital Art and Design 1",
            page=12,
            code="ART51S/ART52S",
            credits=1,
            grades=all_grades,
            sessions=either,
        ),
        _course(
            title="Theatre Arts",
            page=12,
            code="THR11S",
            credits=1,
            grades=all_grades,
            sessions=first,
        ),
        # Mathematics
        _course(
            title="Algebra 1",
            page=13,
            code="MTH15S/MTH16S",
            credits=2,
            grades=all_grades,
            sessions=either,
            duration="full_summer",
            prerequisites=["Algebra 1 (MTH151/152)"],
            notes=["Both semesters are required for grade 9."],
        ),
        _course(
            title="Geometry",
            page=13,
            code="MTH25S/MTH26S",
            credits=1,
            grades=[10, 11, 12],
            sessions=either,
            prerequisites=[
                "approval of director",
                "completion of Algebra 1 (MTH151/152)",
            ],
        ),
        _course(
            title="Algebra 2",
            page=14,
            code="MTH51S/MTH52S",
            credits=1,
            grades=[10, 11, 12],
            sessions=either,
            prerequisites=["Algebra 2 (MTH351/352)"],
        ),
        _course(
            title="Algebra 2 AB/BC",
            page=14,
            code="MTH37S/MTH38S",
            credits=1,
            grades=[10, 11, 12],
            sessions=either,
            prerequisites=[
                "approval of director",
                "completion of Geometry AB/BC (MTH271/272)",
            ],
        ),
        # Multilingual Learning and ELD
        _course(
            title="ELD Skills in Focus: Oracy and Literacy",
            page=15,
            code="ELD11S",
            credits=1,
            grades=all_grades,
            sessions=first,
            prerequisites=[
                "Multilingual Advanced Literature or Language (ELL361/362 or ELL371/372)",
                "ELD World and Contemporary Literature (ELL461/462)",
            ],
        ),
        _course(
            title="ELD Study Skills",
            page=15,
            code="ELD32S",
            credits=0.5,
            grades=all_grades,
            sessions=second,
            prerequisites=["Enrollment in ELD Program or Approval of Director"],
        ),
        _course(
            title="ELD English Enrichment",
            page=15,
            code="ELD21S",
            credits=1,
            grades=all_grades,
            sessions=first,
            prerequisites=["Enrollment in ELD Program (going into Intermediate or Advanced) or Approval of Director"],
        ),
        # Physical Welfare / Science
        _course(
            title="Health Education",
            page=16,
            code="PED21S/PED22S",
            credits=1,
            grades=[10],
            sessions=either,
            fulfills=["Health"],
        ),
        _course(
            title="Astronomy",
            page=16,
            code="SCI21S",
            credits=1,
            grades=[10, 11, 12],
            sessions=first,
            prerequisites=["Successful completion of one year of high school science"],
        ),
        _course(
            title="Introduction to Biotechnology",
            page=16,
            code="SCI31S/SCI33S",
            credits=0.5,
            grades=all_grades,
            sessions=first,
        ),
        # Social Studies
        _course(
            title="World History and Geography",
            page=17,
            code="SOC13S/SOC14S",
            credits=2,
            grades=all_grades,
            sessions=either,
            duration="full_summer",
            fulfills=["World History and Geography"],
            notes=["Both semesters are required."],
        ),
        _course(
            title="Economics",
            page=17,
            code="SOC43S/SOC44S",
            credits=1,
            grades=[11, 12],
            sessions=either,
            fulfills=["Economics or Personal Finance"],
        ),
        _course(
            title="Government",
            page=17,
            code="SOC41S",
            credits=1,
            grades=[12],
            sessions=first,
            fulfills=["Government"],
            prerequisites=["World History and Geography and U.S. History"],
        ),
        _course(
            title="U.S. History",
            page=17,
            code="SOC33S/SOC34S",
            credits=2,
            grades=[11, 12],
            sessions=either,
            duration="full_summer",
            fulfills=["U.S. History"],
            prerequisites=["World History and Geography"],
        ),
        # Special Education / Student Learning Programs
        _course(
            title="Reading and Writing for Stevenson",
            page=18,
            code="IEN51S/IEN52S",
            credits=1,
            grades=[9],
            sessions=either,
            prerequisites=["Special Education Identification and Approval of Director"],
            notes=["Students may register for both semesters."],
        ),
        _course(
            title="Preparing for Life",
            page=18,
            code="IJOB2S",
            credits=1,
            grades=all_grades,
            sessions=second,
            prerequisites=["Special Education Identification and Approval of Director"],
        ),
        _course(
            title="ACT Preparatory Course",
            page=18,
            code="ACTPREPS/ACTPREPS2",
            credits=None,
            grades=[10, 11, 12],
            sessions=either,
        ),
        # Student Services
        _course(
            title="Keys to Success",
            page=19,
            code="TCH91S/TCH92S",
            credits=0.5,
            grades=all_grades,
            sessions=either,
        ),
    ]


def build_catalog() -> Dict[str, Any]:
    courses = source_courses()
    catalog: Dict[str, Any] = {
        "schemaVersion": "summer-school-catalog/v1",
        "source": {"file": config.SOURCE_PDF_NAME, "page": 8},
        "generatedAt": "2026-08-11T00:00:00+00:00",
        "courses": courses,
        "warnings": [
            "Built from the SummerSchool2627.pdf text layer; course descriptions were intentionally omitted.",
            "Course equivalence annotations are conservative normalized-title matches against the regular catalog.",
        ],
    }
    return catalog_matching.annotate_catalog(catalog)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(config.READY_CATALOG), help="Ready catalog JSON path")
    parser.add_argument(
        "--report",
        default=str(config.VALIDATION_REPORT),
        help="Validation report JSON path",
    )
    args = parser.parse_args()

    catalog = build_catalog()
    result = validate.validate_catalog(catalog)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    Path(args.report).write_text(
        json.dumps(result.to_dict(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "readyCatalog": args.out,
                "courses": len(catalog["courses"]),
                "matched": sum(
                    1
                    for course in catalog["courses"]
                    if course.get("regularCourseMatch", {}).get("status") == "matched"
                ),
                "summerOnly": sum(1 for course in catalog["courses"] if course.get("isSummerOnly")),
                "validationValid": result.valid,
                "validationErrors": len(result.errors),
                "validationWarnings": len(result.warnings),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
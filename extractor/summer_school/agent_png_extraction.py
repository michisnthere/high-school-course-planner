"""Write the agent-transcribed Summer School extraction from rendered PNGs.

This file records the result of the coding agent visually inspecting
extractor/summer_school/images/page_001.png ... page_020.png. It is not an OCR,
PDF-text, or vision-client pipeline. The normal artifact-producing command is:

    python -m extractor.summer_school.agent_png_extraction
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import catalog_matching, config, validate

PACKAGE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = PACKAGE_DIR / "images"
EXTRACTED_DIR = PACKAGE_DIR / "extracted"
COMBINED_DIR = PACKAGE_DIR / "output" / "combined"


def key(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def course(
    title: str,
    page: int,
    division: str,
    department: Optional[str],
    code: Optional[str],
    credits: Optional[float],
    grades: List[int],
    sessions: List[str],
    duration: str,
    *,
    description: str,
    credit_status: Optional[str] = None,
    credit_type: Optional[str] = None,
    prerequisites: Optional[List[str]] = None,
    fulfills: Optional[List[str]] = None,
    notes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return {
        "title": title,
        "key": key(title),
        "courseCode": code,
        "description": description,
        "division": division,
        "department": department,
        "credits": credits,
        "creditType": credit_type,
        "gradeLevels": grades,
        "prerequisites": prerequisites or [],
        "corequisites": [],
        "fulfillsRequirements": fulfills or [],
        "attributes": [],
        "notes": notes or [],
        "sourceReference": {"file": config.SOURCE_PDF_NAME, "page": page},
        "sessions": sessions,
        "duration": duration,
        "creditStatus": credit_status or ("credit" if credits is not None else "unknown"),
        "regularCourseMatch": None,
        "isSummerOnly": True,
        "extractionIssues": [],
    }


def page_courses() -> Dict[int, List[Dict[str, Any]]]:
    s1 = [config.SUMMER_SESSION_1]
    s2 = [config.SUMMER_SESSION_2]
    both = [config.SUMMER_SESSION_1, config.SUMMER_SESSION_2]
    one = config.DURATION_ONE_SESSION
    full = config.DURATION_FULL_SUMMER
    all_grades = [9, 10, 11, 12]

    return {
        8: [
            course("Driver Education", 8, "Applied Arts", "Business Education", "D/E21S/D/E22S", 1, [10, 11, 12], both, one, description="This course is a two-phase program consisting of classroom and behind-the-wheel instruction. The course prepares students for safe motor vehicle operation in a suburban driving environment.", prerequisites=["Age 15 before the first day of summer school, parental consent, an instruction permit issued by the Secretary of State's office (which will be obtained by the Driver Education Department in May) and have earned at least eight (8) credits in the previous two semesters. Students in the ELD program must have completed ELD 2 to register for Driver Education."], fulfills=["Driver Education"], notes=["Cost: $425/semester + $400 behind the wheel driving + $20 fee to be paid to the Illinois Secretary of State's office for a driving permit.", "Grade earned is not included in GPA.", "Students must be 15 years old to obtain an Illinois driving permit."]),
            course("Introduction to Business", 8, "Applied Arts", "Business Education", "BUS71S/BUS72S", 1, all_grades, both, one, description="Introduction to Business provides students with a foundational understanding of the business world. This course explores key topics including marketing, accounting, international business and entrepreneurship.", credit_type="GPA Waiver Option", prerequisites=[]),
            course("Business Applications and Technology 1", 8, "Applied Arts", "Business Education", "BUS12S", 1, all_grades, s2, one, description="Students must be able to use technology effectively. Business Applications and Technology 1 teaches students how to use a variety of software programs and multimedia platforms as they create a business concept.", credit_type="GPA Waiver Option", prerequisites=[]),
        ],
        9: [
            course("Careers in Business", 9, "Career Exploration", None, "CAR53S", 0.5, [10, 11, 12], s1, one, description="A two-week course for students interested in learning more about careers in business, including finance, digital marketing, entrepreneurship, management and trending careers.", credit_type="Pass/Fail", prerequisites=[]),
            course("Careers in Law", 9, "Career Exploration", None, "CAR35S", 0.5, [10, 11, 12], s1, one, description="A two-week course for students wishing to explore careers in law, including becoming an attorney and other career paths.", credit_type="Pass/Fail", prerequisites=[]),
            course("Careers in Healthcare and Medicine", 9, "Career Exploration", None, "CAR31S/CAR33S", 0.5, [10, 11, 12], s1, one, description="A two-week course for students who want to explore careers in healthcare. A variety of healthcare professions will be highlighted.", credit_type="Pass/Fail", prerequisites=[]),
            course("Careers in STEM", 9, "Career Exploration", None, "CAR62S", 0.5, [10, 11, 12], s2, one, description="A two-week course for students wishing to explore careers in STEM (Science, Technology, Engineering, Math).", credit_type="Pass/Fail", prerequisites=[]),
        ],
        10: [
            course("College Essay Workshop", 10, "Communication Arts", None, "ENG51S/ENG53S/ENG55S/ENG54S/ENG56S", None, [11, 12], both, one, description="Students will write college essays/personal statements for multiple college applications similar to those typically written during the summer and fall of senior year.", credit_status="non-credit", prerequisites=[], notes=["Four-day course offered five different times; students may register for multiple sessions.", "ENG53S and ENG54S are 4-8:30 p.m. sections.", "ENG53S will only be offered in person. ENG54S will only be offered virtually via Zoom."]),
            course("Creative Writing", 10, "Communication Arts", None, "ENG57S", 1, [11, 12], s1, one, description="Students learn to express their thoughts through writing short stories, poems and plays.", credit_type="Accelerated Option Available", prerequisites=[], fulfills=["English"], notes=["1 semester English credit for grade 11; 1 semester English credit for grade 12."]),
            course("English Failure Credit Recovery", 10, "Communication Arts", None, "ENG25S", 1, [10, 11, 12], s1, one, description="This writing-intensive one-semester course is for students who need to earn Freshman, Sophomore, Junior or Senior English credit due to a failure of either first or second semester.", prerequisites=["Prior enrollment in Freshman, Sophomore, Junior and/or Senior English"], fulfills=["English"]),
            course("Reading for College", 10, "Communication Arts", None, "ENG71S", 1, [10, 11, 12], s1, one, description="This course is designed for students wanting to improve their reading and analysis skills for diverse content types or prepare for the ACT and SAT.", credit_type="GPA Waiver Option", prerequisites=[]),
        ],
        11: [
            course("Computer Programming 1", 11, "Computer Science", None, "CSC61S", 1, all_grades, s1, one, description="This one-semester course introduces students to the foundations of computer programming using Python.", credit_type="GPA Waiver Option", prerequisites=[]),
            course("Computer Programming 2", 11, "Computer Science", None, "CSC82S", 1, all_grades, s2, one, description="This one-semester course is intended for students who possess some programming experience or have successfully completed Computer Programming 1.", credit_type="GPA Waiver Option", prerequisites=["Computer Programming 1 (CSC161/162) or Web Development 2 (TEC281/282) or Principles of Engineering (TEC301/302), or AP Computer Science Principles (CSC371/372)"]),
        ],
        12: [
            course("Art and Design", 12, "Fine Arts", None, "ART11S/ART12S", 1, all_grades, both, one, description="Students explore a variety of tools, techniques and media and develop skills in drawing, painting, sculpture and ceramics.", credit_type="GPA Waiver Option", prerequisites=[]),
            course("Digital Art and Design 1", 12, "Fine Arts", None, "ART51S/ART52S", 1, all_grades, both, one, description="This course introduces students to Adobe Photoshop and Procreate as drawing and graphic design tools.", credit_type="GPA Waiver Option", prerequisites=[]),
            course("Photography 1", 12, "Fine Arts", None, "ART31S/ART32S", 1, all_grades, both, one, description="Photography 1 covers basic concepts and practice of digital photography, including understanding and use of the camera, lenses and other basic photographic equipment.", credit_type="GPA Waiver Option", prerequisites=["Students may use their own DSLR; however, students will be issued a school-owned DSLR camera for this class, if needed."]),
            course("Theatre Arts", 12, "Fine Arts", None, "THR11S", 1, all_grades, s1, one, description="This course is designed as an introduction to creative dramatics and stagecraft.", credit_type="GPA Waiver Option", prerequisites=[]),
        ],
        13: [
            course("Algebra 1", 13, "Mathematics", None, "MTH15S/MTH16S", 2, all_grades, both, full, description="Algebra 1 helps students develop proficiency in algebraic thinking.", prerequisites=["Algebra 1 (MTH151/152)"], notes=["Both semesters are required for grade 9.", "Printed credit: 1 credit per semester."]),
            course("Geometry", 13, "Mathematics", None, "MTH25S/MTH26S", 1, [10, 11, 12], both, one, description="Geometry helps students develop proficiency in deductive reasoning and geometric thinking.", prerequisites=["Approval of director and completion of Algebra 1 (MTH151/152)"], notes=["Students seeking credit recovery may enroll in individual semesters."]),
        ],
        14: [
            course("Algebra 2", 14, "Mathematics", None, "MTH51S/MTH52S", 1, [10, 11, 12], both, one, description="Algebra 2 builds upon students' prior experiences in geometric relationships and deductive reasoning to deepen fluency with algebraic thinking.", prerequisites=["Algebra 2 (MTH351/352)"], notes=["Students seeking credit recovery may enroll in individual semesters."]),
            course("Algebra 2 AB/BC", 14, "Mathematics", None, "MTH37S/MTH38S", 2, [10, 11, 12], both, full, description="Algebra 2 AB/BC attends to all the learning outcomes of Algebra 2 and substantially extends the topics.", prerequisites=["Approval of director and completion of Geometry AB/BC (MTH271/272)"], notes=["Both semesters are required for students seeking accelerated coursework.", "Students seeking credit recovery may enroll in individual semesters.", "Printed credit: 1 credit per semester."]),
        ],
        15: [
            course("ELD Skills in Focus: Oracy and Literacy", 15, "Multilingual Learning and ELD", None, "ELD11S", 1, all_grades, s1, one, description="This one-semester course is designed to strengthen the literacy and oracy skills of students who are taking or have taken more advanced ELD coursework.", credit_type="Pass/Fail", prerequisites=["Multilingual Advanced Literature or Language (ELL361/362 or ELL371/372) or ELD World and Contemporary Literature (ELL461/462)"]),
            course("ELD Study Skills", 15, "Multilingual Learning and ELD", None, "ELD32S", 0.5, all_grades, s2, one, description="This course for incoming students in our ELD program is designed to build and enrich English skills applicable across content areas.", credit_type="Pass/Fail", prerequisites=["Enrollment in ELD Program or Approval of Director"]),
            course("ELD English Enrichment", 15, "Multilingual Learning and ELD", None, "ELD21S", 1, all_grades, s1, one, description="This one-semester course is designed to enrich the academic English skills of incoming students in our ELD program.", credit_type="Pass/Fail", prerequisites=["Enrollment in ELD Program (going into Intermediate or Advanced) or Approval of Director"]),
        ],
        16: [
            course("Health Education", 16, "Physical Welfare", None, "PED21S/PED22S", 1, [10], both, one, description="The following Health Education units are taught: Wellness and Mental Health; Adult CPR and AED; Fitness and Personal Health; Reality of Drugs; Social Health.", prerequisites=[], fulfills=["Health"], notes=["This course is required for graduation.", "Students taking summer school Health will not be certified in Adult CPR."]),
            course("Astronomy", 16, "Science", None, "SCI21S", 1, [10, 11, 12], s1, one, description="Astronomy is the scientific study of the origin, structure and evolution of the universe and the objects in it.", credit_type="GPA Waiver Option", prerequisites=["Successful completion of one year of high school science"]),
            course("Introduction to Biotechnology", 16, "Science", None, "SCI31S/SCI33S", 0.5, all_grades, s1, one, description="A two-week course for students who want to learn and practice skills and techniques used in biotechnology.", credit_type="Pass/Fail", prerequisites=[]),
        ],
        17: [
            course("World History and Geography", 17, "Social Studies", None, "SOC13S/SOC14S", 2, all_grades, both, full, description="World History and Geography focuses on disciplinary skills of comprehension, analysis and argumentation using a framework for the intensified eight-week curriculum.", prerequisites=[], fulfills=["World History and Geography"], notes=["Both semesters are required.", "Printed credit: 1 credit per semester."]),
            course("U.S. History", 17, "Social Studies", None, "SOC33S/SOC34S", 2, [11, 12], both, full, description="This sequence fulfills the graduation requirement of one year of U.S. history as established by the state of Illinois.", prerequisites=["World History and Geography"], fulfills=["U.S. History"]),
            course("Economics", 17, "Social Studies", None, "SOC43S/SOC44S", 1, [11, 12], both, one, description="This course is designed to acquaint students with the economic knowledge and decision-making skills they will need as informed citizens.", prerequisites=[], fulfills=["Economics or Personal Finance"]),
            course("Government", 17, "Social Studies", None, "SOC41S", 1, [12], s1, one, description="Topics include federal, state and local government, methods of selecting candidates for office, and mechanics of voting.", prerequisites=["World History and Geography and U.S. History"], fulfills=["Government"], notes=["This course satisfies the Illinois civics requirement and Stevenson's graduation requirement of one semester of government."]),
        ],
        18: [
            course("Reading and Writing for Stevenson", 18, "Special Education", None, "IEN51S/IEN52S", 1, [9], both, one, description="This survey course will familiarize and instruct special education students in the many reading and writing assignments they will encounter in their coursework at Stevenson.", credit_type="GPA Waiver Option", prerequisites=["Special Education Identification and Approval of Director"], notes=["Students may register for both semesters."]),
            course("Preparing for Life", 18, "Special Education", None, "IJOB2S", 1, all_grades, s2, one, description="This course is designed to provide students with a variety of hands-on learning opportunities to help them acquire the necessary life skills to be as independent as possible.", prerequisites=["Special Education Identification and Approval of Director"], notes=["Not available for students entering transition program."]),
            course("ACT Preparatory Course", 18, "Student Learning Programs", None, "ACTPREPS/ACTPREPS2", None, [10, 11, 12], both, one, description="This five-day course will be taught by subject-area instructors and focus on essential skills assessed on the ACT.", credit_status="non-credit", prerequisites=[]),
        ],
        19: [
            course("Keys to Success", 19, "Student Services", None, "TCH91S/TCH92S", 0.5, all_grades, both, one, description="This course will prepare students to cope with the academic expectations of high school and beyond.", credit_type="Pass/Fail", prerequisites=[]),
        ],
    }


def write_page_files(pages: Dict[int, List[Dict[str, Any]]]) -> None:
    EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
    for page in range(1, 21):
        result = {
            "sourceReference": {"file": config.SOURCE_PDF_NAME, "page": page},
            "sourcePage": page,
            "sourceImage": str(IMAGES_DIR / f"page_{page:03d}.png"),
            "courses": pages.get(page, []),
            "warnings": [] if pages.get(page) else ["page contains no course listings"],
        }
        (EXTRACTED_DIR / f"page_{page:03d}.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


def write_catalog(pages: Dict[int, List[Dict[str, Any]]]) -> Dict[str, Any]:
    courses = [course for page in range(1, 21) for course in pages.get(page, [])]
    catalog = {
        "schemaVersion": "summer-school-catalog/v1",
        "source": {"file": config.SOURCE_PDF_NAME, "page": 1},
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "extractionMethod": "agent_read_rendered_pngs_directly",
        "sourceImages": str(IMAGES_DIR),
        "courses": courses,
        "warnings": [],
    }
    catalog_matching.annotate_catalog(catalog)
    for c in catalog["courses"]:
        if c.get("regularCourseMatch", {}).get("status") != "matched":
            c["regularCourseMatch"] = None
            c["isSummerOnly"] = True
    COMBINED_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("summer-school-catalog.json", "summer-school-ready.json"):
        (COMBINED_DIR / name).write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    result = validate.validate_catalog(catalog, known_requirements=validate.load_known_requirements())
    (COMBINED_DIR / "validation-report.json").write_text(json.dumps(result.to_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return catalog


def main() -> None:
    pages = page_courses()
    write_page_files(pages)
    catalog = write_catalog(pages)
    print(json.dumps({"pages": 20, "coursePages": len(pages), "courses": len(catalog["courses"]), "readyCatalog": str(COMBINED_DIR / "summer-school-ready.json")}, indent=2))


if __name__ == "__main__":
    main()

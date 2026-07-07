from typing import List, Literal, NotRequired, Optional, TypedDict

RequirementType = Literal["credits", "semesters", "completion", "waiver", "policy", "unknown"]


class DepartmentRecord(TypedDict):
    name: Optional[str]
    description: Optional[str]


class CourseOfferingRecord(TypedDict):
    courseCode: Optional[str]
    semesterLabel: Optional[str]
    duration: Optional[str]
    gradeLevels: List[int]
    prerequisites: List[str]
    creditType: Optional[str]
    credits: Optional[float]


class CourseChoiceRecord(TypedDict):
    name: str
    isOnline: bool
    gpaWaiverOption: bool
    creditType: Optional[str]
    credits: Optional[float]
    offerings: List[CourseOfferingRecord]


class CourseRecord(TypedDict):
    title: str
    department: Optional[str]
    description: Optional[str]
    gpaWaiverOption: NotRequired[Optional[bool]]
    isOnline: NotRequired[bool]
    offerings: NotRequired[Optional[List[CourseOfferingRecord]]]
    choices: NotRequired[Optional[List[CourseChoiceRecord]]]
    notes: List[str]
    sourceReference: Optional[str]


class RequirementRecord(TypedDict):
    name: str
    category: Optional[str]
    requirementType: RequirementType
    requiredValue: Optional[float]
    eligibleCourses: List[str]
    waiverRules: List[str]
    notes: List[str]
    sourceReference: Optional[str]


class AcademicExtractionResult(TypedDict):
    sourcePage: int
    departments: List[DepartmentRecord]
    courses: List[CourseRecord]
    graduationRequirements: List[RequirementRecord]
    warnings: List[str]


class SectionExtractionResult(TypedDict):
    departments: List[DepartmentRecord]
    courses: List[CourseRecord]
    graduationRequirements: List[RequirementRecord]
    warnings: List[str]

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
    notes: NotRequired[List[str]]


class CourseChoiceRecord(TypedDict):
    name: str
    isOnline: bool
    gpaWaiverOption: bool
    creditType: Optional[str]
    credits: Optional[float]
    offerings: List[CourseOfferingRecord]
    notes: NotRequired[List[str]]


class CourseRecord(TypedDict):
    title: str
    department: Optional[str]
    description: Optional[str]
    fulfillsRequirements: List[str]
    gpaWaiverOption: NotRequired[Optional[bool]]
    creditType: NotRequired[Optional[str]]
    credits: NotRequired[Optional[float]]
    offerings: NotRequired[Optional[List[CourseOfferingRecord]]]
    choices: NotRequired[Optional[List[CourseChoiceRecord]]]
    notes: NotRequired[List[str]]
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

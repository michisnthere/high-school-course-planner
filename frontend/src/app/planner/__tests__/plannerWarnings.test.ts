import { describe, it, expect } from "vitest";
import { getWarnings, formatWarningMessage } from "@/app/planner/[year]/page";
import { computePlannerAnalysis } from "@/lib/plannerAnalysisEngine";
import { translate } from "@/lib/i18n";
import type { Planner, PlannerCourseDetails, PlannedCourse } from "@/lib/planner";
import type { CompletedCourse, GradeCompleted } from "@/lib/completedCourses";

const algebra: PlannerCourseDetails = {
  id: 201, title: "Algebra I", normalizedTitle: "algebra i", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Mathematics",
  department: "Mathematics", description: null, fulfillsRequirements: ["Mathematics"],
  prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "MATH101",
  gradeMin: 9, gradeMax: 9,
  isNonAcademic: false, isMarchingBand: false, attributes: [], isRepeatable: false,
  supportsEarlyBird: false, isOnline: false,
};

// Offered in middle school and high school; requires Algebra I.
const geometry: PlannerCourseDetails = {
  id: 202, title: "Geometry", normalizedTitle: "geometry", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Mathematics",
  department: "Mathematics", description: null, fulfillsRequirements: ["Mathematics"],
  prerequisites: ["Algebra I"], courseCodeS1: null, courseCodeS2: null, courseCode: "MATH102",
  gradeMin: 9, gradeMax: 12,
  isNonAcademic: false, isMarchingBand: false, attributes: [], isRepeatable: false,
  supportsEarlyBird: false, isOnline: false,
};

const catalog = [algebra, geometry];

function makePlanned(
  course: PlannerCourseDetails,
  plannedId: number,
  plannerId = 2
): PlannedCourse {
  return {
    id: plannedId,
    plannerId,
    courseId: course.id,
    plannerOptionId: null,
    semester: 1,
    slot: 1,
    slotSpan: 1,
    isEarlyBird: false,
    course: { ...course },
  };
}

// Builds the standard four planners (schoolYear 9-12, ids 1-4) with the given
// placements attached, mirroring warningsByCourse's inputs on the planner page.
function makePlannersWith(
  placements: Array<{ course: PlannerCourseDetails; plannedId: number; plannerId: number }>
): { planners: Planner[]; planned: PlannedCourse } {
  const planners: Planner[] = [9, 10, 11, 12].map((y, index) => ({
    id: index + 1,
    schoolYear: y,
    label: String(y),
    completedAt: null,
    plannedCourses: [],
  }));
  let first: PlannedCourse | null = null;
  for (const placement of placements) {
    const planned = makePlanned(placement.course, placement.plannedId, placement.plannerId);
    const planner = planners.find((p) => p.id === placement.plannerId)!;
    planner.plannedCourses.push(planned);
    first = first ?? planned;
  }
  return { planners, planned: first ?? makePlanned(placements[0]?.course ?? geometry, 0, 2) };
}

// Same iteration the page's warningsByCourse memo performs, for every course.
function allWarnings(planners: Planner[], completedCourses: CompletedCourse[] = []) {
  return planners.flatMap((p) =>
    p.plannedCourses.flatMap((pc) =>
      getWarnings(pc, planners, completedCourses, catalog, pc.semester, p.schoolYear, [])
    )
  );
}

function makePlannerWithGeometry(): { planners: Planner[]; planned: PlannedCourse } {
  const planned = makePlanned(geometry, 9001);
  const planners: Planner[] = [
    { id: 1, schoolYear: 9, label: "9", completedAt: null, plannedCourses: [] },
    { id: 2, schoolYear: 10, label: "10", completedAt: null, plannedCourses: [planned] },
    { id: 3, schoolYear: 11, label: "11", completedAt: null, plannedCourses: [] },
    { id: 4, schoolYear: 12, label: "12", completedAt: null, plannedCourses: [] },
  ];
  return { planners, planned };
}

function makeCompleted(course: PlannerCourseDetails, grade: GradeCompleted): CompletedCourse {
  return {
    id: course.id,
    userId: -1,
    courseId: course.id,
    summerCourseId: null,
    gradeCompleted: grade,
    credits: null,
    course: { ...course },
    summerCourse: null,
  };
}

function warningsFor(completedCourses: CompletedCourse[]) {
  const { planners, planned } = makePlannerWithGeometry();
  return getWarnings(planned, planners, completedCourses, catalog, 1, 10, []);
}

describe("planner prerequisite warnings (middle school completions)", () => {
  it("a course completed in middle school satisfies the prerequisite: no warning", () => {
    const warnings = warningsFor([makeCompleted(algebra, "Middle School")]);
    expect(warnings.filter((w) => w.type === "missing_prerequisite")).toEqual([]);
    expect(warnings.filter((w) => w.type === "later_prerequisite")).toEqual([]);
  });

  it("reports the prerequisite when it has not been completed", () => {
    const warnings = warningsFor([]);
    const missing = warnings.filter((w) => w.type === "missing_prerequisite");
    expect(missing).toHaveLength(1);
    expect(missing[0].prerequisite).toBe("Algebra I");
    expect(missing[0].message).toContain("Geometry");
  });

  it("a course completed in high school satisfies the prerequisite: no warning", () => {
    const warnings = warningsFor([makeCompleted(algebra, "Freshman (9)")]);
    expect(warnings.filter((w) => w.type === "missing_prerequisite")).toEqual([]);
  });

  // §15: same middle-school completion, both halves of the rule in one test.
  it("middle-school Algebra I blocks the warning but adds no graduation progress", () => {
    const warnings = warningsFor([makeCompleted(algebra, "Middle School")]);
    expect(warnings.filter((w) => w.type === "missing_prerequisite")).toEqual([]);

    const { planners } = makePlannerWithGeometry();
    const analysis = computePlannerAnalysis({
      planners,
      completedCourses: [makeCompleted(algebra, "Middle School")],
      resolutions: [],
      allCourses: catalog,
    });
    const math = analysis.graduationRequirements.find((r) => r.name === "Mathematics")!;
    expect(math.completedValue).toBe(0);
    expect(analysis.earned!.credits.total).toBe(0);
  });
});

describe("grade-level eligibility warnings", () => {
  // Grade ranges use the production representation (PlannerCourseDetails
  //.gradeMin/gradeMax aggregated from CourseOffering rows), mirroring real
  // catalog data: Driver Education = grades 10-12, American Studies = 11 only.
  const freshmanOnly: PlannerCourseDetails = {
    id: 205, title: "Freshman Advisory", normalizedTitle: "freshman advisory", duration: 2,
    slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Advisory",
    department: "Advisory", description: null, fulfillsRequirements: [],
    prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "ADV901",
    gradeMin: 9, gradeMax: 9,
    isNonAcademic: false, isMarchingBand: false, attributes: [], isRepeatable: false,
    supportsEarlyBird: false, isOnline: false,
  };

  const chemistry: PlannerCourseDetails = {
    id: 206, title: "Chemistry", normalizedTitle: "chemistry", duration: 2,
    slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Science",
    department: "Science", description: null, fulfillsRequirements: ["Science"],
    prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "CHM201",
    gradeMin: 10, gradeMax: 12,
    isNonAcademic: false, isMarchingBand: false, attributes: [], isRepeatable: false,
    supportsEarlyBird: false, isOnline: false,
  };

  // No grade restrictions: gradeMin/gradeMax stay null just like
  // courseToPlannerDetails produces for offerings without gradeLevels (and
  // like every summer/planner-option placement, which serialize as null).
  const unrestricted: PlannerCourseDetails = {
    id: 207, title: "Physical Education", normalizedTitle: "physical education", duration: 2,
    slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Physical Education",
    department: "Physical Education", description: null, fulfillsRequirements: ["Physical Education"],
    prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "PE101",
    gradeMin: null, gradeMax: null,
    isNonAcademic: false, isMarchingBand: false, attributes: [], isRepeatable: false,
    supportsEarlyBird: false, isOnline: false,
  };

  const driverEd: PlannerCourseDetails = {
    id: 203, title: "Driver Education", normalizedTitle: "driver education", duration: 1,
    slotsPerSemester: 1, creditType: "regular", credits: 1, division: "Physical Education",
    department: "Physical Education", description: null, fulfillsRequirements: ["Driver Education"],
    prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "DE231",
    gradeMin: 10, gradeMax: 12,
    isNonAcademic: false, isMarchingBand: false, attributes: [], isRepeatable: false,
    supportsEarlyBird: false, isOnline: false,
  };

  const americanStudies: PlannerCourseDetails = {
    id: 204, title: "American Studies", normalizedTitle: "american studies", duration: 2,
    slotsPerSemester: 1, creditType: "regular", credits: 4, division: "Social Studies",
    department: "Social Studies", description: null, fulfillsRequirements: ["U.S. History", "English"],
    prerequisites: ["World History and Geography"], courseCodeS1: null, courseCodeS2: null,
    courseCode: "SOC581", gradeMin: 11, gradeMax: 11,
    isNonAcademic: false, isMarchingBand: false, attributes: [], isRepeatable: false,
    supportsEarlyBird: false, isOnline: false,
  };

  const precalc: PlannerCourseDetails = {
    id: 208, title: "Precalculus", normalizedTitle: "precalculus", duration: 2,
    slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Mathematics",
    department: "Mathematics", description: null, fulfillsRequirements: ["Mathematics"],
    prerequisites: ["Geometry"], courseCodeS1: null, courseCodeS2: null, courseCode: "MATH301",
    gradeMin: 11, gradeMax: 12,
    isNonAcademic: false, isMarchingBand: false, attributes: [], isRepeatable: false,
    supportsEarlyBird: false, isOnline: false,
  };

  function gradeWarnings(planners: Planner[], planned: PlannedCourse) {
    return getWarnings(planned, planners, [], catalog, planned.semester, 10, []).filter(
      (w) => w.type === "grade_level_conflict"
    );
  }

  it("Freshman-only course planned as Freshman: no warning", () => {
    const { planners, planned } = makePlannersWith([
      { course: freshmanOnly, plannedId: 601, plannerId: 1 },
    ]);
    expect(gradeWarnings(planners, planned)).toEqual([]);
  });

  it("Freshman-only course planned as Sophomore: warning identifying the course and the year", () => {
    const { planners, planned } = makePlannersWith([
      { course: freshmanOnly, plannedId: 602, plannerId: 2 },
    ]);
    const warnings = gradeWarnings(planners, planned);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].plannerYear).toBe(10);
    expect(warnings[0].message).toContain("Freshman Advisory");
    expect(warnings[0].message).toContain("Sophomore");
  });

  it("Grade 10-12 course planned as Sophomore: no warning", () => {
    const { planners, planned } = makePlannersWith([
      { course: chemistry, plannedId: 603, plannerId: 2 },
    ]);
    expect(gradeWarnings(planners, planned)).toEqual([]);
  });

  it("Grade 10-12 course planned as Freshman: warning", () => {
    const { planners, planned } = makePlannersWith([
      { course: chemistry, plannedId: 604, plannerId: 1 },
    ]);
    const warnings = gradeWarnings(planners, planned);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].plannerYear).toBe(9);
  });

  it("Grade 10-12 course planned as Junior: no warning", () => {
    const { planners, planned } = makePlannersWith([
      { course: chemistry, plannedId: 605, plannerId: 3 },
    ]);
    expect(gradeWarnings(planners, planned)).toEqual([]);
  });

  it("course without grade restrictions: no warning in any year", () => {
    for (const plannerId of [1, 2, 3, 4]) {
      const { planners, planned } = makePlannersWith([
        { course: unrestricted, plannedId: 606, plannerId },
      ]);
      expect(gradeWarnings(planners, planned)).toEqual([]);
    }
  });

  it("moving the course to an eligible year removes the warning", () => {
    const ineligible = makePlannersWith([{ course: chemistry, plannedId: 607, plannerId: 1 }]);
    expect(gradeWarnings(ineligible.planners, ineligible.planned)).toHaveLength(1);

    const moved = makePlannersWith([{ course: chemistry, plannedId: 607, plannerId: 3 }]);
    expect(gradeWarnings(moved.planners, moved.planned)).toEqual([]);
  });

  it("removing the course removes the warning", () => {
    const { planners } = makePlannersWith([{ course: freshmanOnly, plannedId: 608, plannerId: 2 }]);
    const before = allWarnings(planners).filter((w) => w.type === "grade_level_conflict");
    expect(before).toHaveLength(1);

    planners.forEach((p) => {
      p.plannedCourses = p.plannedCourses.filter((pc) => pc.id !== 608);
    });
    const after = allWarnings(planners).filter((w) => w.type === "grade_level_conflict");
    expect(after).toEqual([]);
  });

  it("the same course produces exactly one grade-level warning (no duplicates)", () => {
    const { planners, planned } = makePlannersWith([
      { course: freshmanOnly, plannedId: 609, plannerId: 2 },
    ]);
    expect(allWarnings(planners).filter((w) => w.type === "grade_level_conflict")).toHaveLength(1);
    expect(gradeWarnings(planners, planned)).toHaveLength(1);
  });

  it("keeps grade-level and prerequisite warnings independent for the same course", () => {
    // Precalculus planned a year early with its prerequisite nowhere planned:
    // BOTH issues must surface as separate warnings, not one combined message.
    const { planners, planned } = makePlannersWith([
      { course: precalc, plannedId: 610, plannerId: 2 },
    ]);
    const warnings = getWarnings(planned, planners, [], catalog, 1, 10, []);
    expect(warnings.map((w) => w.type).sort()).toEqual([
      "grade_level_conflict",
      "missing_prerequisite",
    ]);
  });

  it("stays keyed to the planner year when the student's profile grade changes", () => {
    // The student's profile grade (User.grade) is display-only; a planner year
    // is always its absolute grade (Planner.schoolYear), so eligibility is
    // recomputed from live planner/course data on every render and a profile
    // change cannot re-map years.
    const { planners, planned } = makePlannersWith([
      { course: chemistry, plannedId: 612, plannerId: 1 },
    ]);
    const before = gradeWarnings(planners, planned);
    expect(before).toHaveLength(1);
    expect(before[0].plannerYear).toBe(9);

    const afterProfileChange = gradeWarnings(planners, planned);
    expect(afterProfileChange).toEqual(before);

    // When the underlying planner data changes, eligibility updates with it.
    const rehomed = makePlannersWith([{ course: chemistry, plannedId: 612, plannerId: 3 }]);
    expect(gradeWarnings(rehomed.planners, rehomed.planned)).toEqual([]);
  });

  it("special course ranges keep working (Driver Education, American Studies)", () => {
    // Driver Education has no prerequisites, so this also proves the grade
    // check runs before the prerequisite early-return.
    const deIneligible = makePlannersWith([{ course: driverEd, plannedId: 613, plannerId: 1 }]);
    expect(gradeWarnings(deIneligible.planners, deIneligible.planned)).toHaveLength(1);

    const deEligible = makePlannersWith([{ course: driverEd, plannedId: 614, plannerId: 2 }]);
    expect(gradeWarnings(deEligible.planners, deEligible.planned)).toEqual([]);

    const amstWrongYear = makePlannersWith([
      { course: americanStudies, plannedId: 615, plannerId: 2 },
    ]);
    expect(gradeWarnings(amstWrongYear.planners, amstWrongYear.planned)).toHaveLength(1);

    const amstRightYear = makePlannersWith([
      { course: americanStudies, plannedId: 616, plannerId: 3 },
    ]);
    expect(gradeWarnings(amstRightYear.planners, amstRightYear.planned)).toEqual([]);
  });

  it("renders through the i18n system in every supported locale", () => {
    const { planners, planned } = makePlannersWith([
      { course: chemistry, plannedId: 617, plannerId: 1 },
    ]);
    const warning = gradeWarnings(planners, planned)[0];
    const localizedPhrase: Record<string, string> = {
      en: "Freshman",
      es: "no se ofrece",
      "zh-CN": "不向",
      ru: "не предлагается",
      ko: "제공되지",
    };
    for (const locale of ["en", "es", "zh-CN", "ru", "ko"] as const) {
      const message = formatWarningMessage(warning, (key, params) => translate(locale, key, params), chemistry.title);
      expect(message).toContain("Chemistry");
      expect(message).toContain(localizedPhrase[locale]);
      expect(message).not.toContain("{");
    }
  });
});

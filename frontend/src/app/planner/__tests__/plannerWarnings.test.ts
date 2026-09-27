import { describe, it, expect } from "vitest";
import { getWarnings } from "@/app/planner/[year]/page";
import { computePlannerAnalysis } from "@/lib/plannerAnalysisEngine";
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

function makePlanned(course: PlannerCourseDetails, plannedId: number): PlannedCourse {
  return {
    id: plannedId,
    plannerId: 2,
    courseId: course.id,
    plannerOptionId: null,
    semester: 1,
    slot: 1,
    slotSpan: 1,
    isEarlyBird: false,
    course: { ...course },
  };
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

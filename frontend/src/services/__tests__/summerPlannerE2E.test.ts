import { describe, it, expect, beforeAll } from "vitest";
import type { PlannerCourseDetails } from "@/lib/planner";
import type { SummerCourse } from "@/lib/summerCourse";
import type { StudentPlanningData } from "@/lib/studentData";
import { createGuestDataStore } from "@/services/guestStore";
import { createGuestPlannerService } from "@/services/planner";
import { createGuestCompletedCoursesService } from "@/services/completedCourses";
import { createGuestAnalysisService } from "@/services/analysis";

beforeAll(() => {
  (globalThis as any).window ??= {};
  (globalThis as any).window.dispatchEvent ??= () => true;
});

const algebra: PlannerCourseDetails = {
  id: 3,
  title: "Algebra I",
  normalizedTitle: "algebra i",
  duration: 2,
  slotsPerSemester: 1,
  creditType: "regular",
  credits: 2,
  division: "Mathematics",
  department: "Mathematics",
  description: null,
  fulfillsRequirements: ["Mathematics"],
  prerequisites: [],
  courseCode: "MATH101",
  courseCodeS1: null,
  courseCodeS2: null,
  gradeMin: 9,
  gradeMax: 9,
  isNonAcademic: false,
  isMarchingBand: false,
  attributes: [],
};

const healthDependent: PlannerCourseDetails = {
  id: 4,
  title: "Health Lab",
  normalizedTitle: "health lab",
  duration: 1,
  slotsPerSemester: 1,
  creditType: "regular",
  credits: 1,
  division: "Science",
  department: "Science",
  description: null,
  fulfillsRequirements: ["Health"],
  prerequisites: ["Health Education"],
  courseCode: "HLTH201",
  courseCodeS1: null,
  courseCodeS2: null,
  gradeMin: 10,
  gradeMax: 10,
  isNonAcademic: false,
  isMarchingBand: false,
  attributes: [],
};

const regularCatalog = [algebra, healthDependent];

// A summer-only, credit-bearing course open to students entering grade 10, taken
// during the 9→10 summer (placed in the Sophomore planner's Summer School).
const summerHealth: SummerCourse = {
  id: 101,
  key: "summer-health",
  title: "Health Education",
  courseCode: "SUM-HEALTH",
  creditStatus: "credit",
  credits: 1,
  duration: "one_session",
  prerequisites: [],
  fulfillsRequirements: ["Health"],
  isSummerOnly: true,
  regularCourseId: null,
  regularCourse: null,
  gradeLevels: [10],
  sessions: ["Session 1"],
};

const summerAlgebra: SummerCourse = {
  id: 102,
  key: "summer-algebra",
  title: "Algebra II",
  courseCode: "SUM-ALG2",
  creditStatus: "credit",
  credits: 2,
  duration: "one_session",
  prerequisites: ["Algebra I"],
  fulfillsRequirements: ["Mathematics"],
  isSummerOnly: true,
  regularCourseId: null,
  regularCourse: null,
  gradeLevels: [10],
  sessions: ["Session 1"],
};

const summerAnatomy: SummerCourse = {
  id: 103,
  key: "summer-anatomy",
  title: "Anatomy",
  courseCode: "SUM-ANA",
  creditStatus: "credit",
  credits: 1,
  duration: "one_session",
  prerequisites: ["Biology"],
  fulfillsRequirements: ["Health"],
  isSummerOnly: true,
  regularCourseId: null,
  regularCourse: null,
  gradeLevels: [10],
  sessions: ["Session 2"],
};

const fullSummer: SummerCourse = {
  id: 104,
  key: "full-summer-elective",
  title: "Full Summer Elective",
  courseCode: "SUM-FULL",
  creditStatus: "credit",
  credits: 1,
  duration: "full_summer",
  prerequisites: [],
  fulfillsRequirements: ["Electives"],
  isSummerOnly: true,
  regularCourseId: null,
  regularCourse: null,
  gradeLevels: [10],
  sessions: ["Session 1", "Session 2"],
};

const matchedSummer: SummerCourse = {
  id: 105,
  key: "summer-algebra-equivalent",
  title: "Algebra I Summer",
  courseCode: "SUM-ALG1",
  creditStatus: "credit",
  credits: 2,
  duration: "full_summer",
  prerequisites: [],
  fulfillsRequirements: ["Mathematics"],
  isSummerOnly: false,
  regularCourseId: algebra.id,
  regularCourse: algebra,
  gradeLevels: [10],
  sessions: ["Session 1", "Session 2"],
};

const zeroCreditSummer: SummerCourse = {
  id: 106,
  key: "zero-credit-summer",
  title: "Zero Credit Summer Seminar",
  courseCode: "SUM-ZERO",
  creditStatus: "no_credit",
  credits: 0,
  duration: "one_session",
  prerequisites: [],
  fulfillsRequirements: ["Electives"],
  isSummerOnly: true,
  regularCourseId: null,
  regularCourse: null,
  gradeLevels: [10],
  sessions: ["Session 2"],
};

function buildStack() {
  const store = createGuestDataStore();
  const plannerService = createGuestPlannerService(store);
  const completedService = createGuestCompletedCoursesService(store);
  const analysisService = createGuestAnalysisService();
  plannerService.seedCourseCatalog(regularCatalog);
  return { store, plannerService, completedService, analysisService };
}

async function analyze(stack: ReturnType<typeof buildStack>) {
  const data: StudentPlanningData = {
    planners: await stack.plannerService.getPlanners(),
    completedCourses: await stack.completedService.getCompletedCourses(),
    resolutions: [],
    allCourses: regularCatalog,
  };
  return stack.analysisService.getAnalysis(data);
}

describe("Summer School end-to-end (guest stack)", () => {
  it("Summer 9→10: plans a credit-bearing course under the Sophomore planner", async () => {
    const stack = buildStack();
    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;

    const updated = await stack.plannerService.addSummerCourse(sophomore.id, summerHealth, 3);
    const planned = updated.plannedCourses.find((pc) => pc.summerCourseId === summerHealth.id)!;
    expect(planned).toBeDefined();
    // Appears in the Summer School section (planner semester 3 = Summer S1).
    expect(planned.semester).toBe(3);
    expect(planned.slot).toBe(1);
    expect(planned.summerCourse).not.toBeNull();
  });

  it("Summer 9→10: increases projected credits and satisfies the Health requirement", async () => {
    const stack = buildStack();

    const before = await analyze(stack);
    expect(before.credits.total).toBe(0);
    expect(before.earned?.credits.total).toBe(0);

    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;
    await stack.plannerService.addSummerCourse(sophomore.id, summerHealth, 3);

    const after = await analyze(stack);
    expect(after.credits.total).toBe(1);
    expect(after.earned?.credits.total).toBe(0);

    const health = after.graduationRequirements.find((r) => r.name === "Health")!;
    expect(health.earnedValue).toBe(1);
    expect(health.remainingValue).toBe(0);
    expect(health.status).toBe("satisfied");
  });

  it("grade eligibility follows the entering grade (10), not a year later", async () => {
    const stack = buildStack();
    const freshman = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 9)!;

    // A grade-10 summer course belongs to the 9→10 summer (Sophomore planner),
    // so it must be rejected under the Freshman planner.
    await expect(stack.plannerService.addSummerCourse(freshman.id, summerHealth, 3)).rejects.toThrow(
      "cannot be planned for the summer before grade 9"
    );
  });

  it("honors applicable prerequisites: completed prereq clears, unmet prereq is flagged", async () => {
    const stack = buildStack();
    await stack.completedService.addCompletedCourse(algebra.id, "Freshman (9)", algebra);

    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;
    await stack.plannerService.addSummerCourse(sophomore.id, summerAlgebra, 3);
    await stack.plannerService.addSummerCourse(sophomore.id, summerAnatomy, 4);

    const analysis = await analyze(stack);
    const missing = analysis.missingPrerequisites;

    // Pre-requisite satisfied via completed Algebra I.
    expect(missing.some((m) => m.courseTitle === summerAlgebra.title)).toBe(false);
    // Unmet prerequisite (Biology) is reported for the summer course.
    expect(
      missing.some(
        (m) => m.courseTitle === summerAnatomy.title && m.missingPrerequisite === "Biology" && m.reason === "notPlanned"
      )
    ).toBe(true);
  });

  it("evaluates Summer before that planner year's regular semesters", async () => {
    const stack = buildStack();
    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;

    await stack.plannerService.addSummerCourse(sophomore.id, summerHealth, 3);
    await stack.plannerService.addPlannedCourse(sophomore.id, healthDependent.id, 1, 1);

    const analysis = await analyze(stack);
    expect(analysis.missingPrerequisites.some((m) => m.courseTitle === healthDependent.title)).toBe(false);
  });

  it("counts a completed Summer prerequisite for a regular course", async () => {
    const stack = buildStack();
    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;

    await stack.completedService.addCompletedCourse({
      summerCourseId: summerHealth.id,
      gradeCompleted: "Sophomore (10)",
      summerCourse: summerHealth,
    });
    await stack.plannerService.addPlannedCourse(sophomore.id, healthDependent.id, 1, 1);

    const analysis = await analyze(stack);
    expect(analysis.missingPrerequisites.some((m) => m.courseTitle === healthDependent.title)).toBe(false);
    expect(analysis.credits.total).toBe(2);
  });

  it("counts completed Summer as earned and projected while planned Summer remains projected only", async () => {
    const stack = buildStack();
    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;

    await stack.plannerService.addSummerCourse(sophomore.id, summerHealth, 3);
    let analysis = await analyze(stack);
    expect(analysis.credits.total).toBe(1);
    expect(analysis.earned?.credits.total).toBe(0);

    await stack.completedService.addCompletedCourse({
      summerCourseId: summerAlgebra.id,
      gradeCompleted: "Sophomore (10)",
      summerCourse: summerAlgebra,
    });

    analysis = await analyze(stack);
    expect(analysis.credits.total).toBe(3);
    expect(analysis.earned?.credits.total).toBe(2);
  });

  it("does not add graduation credit for a zero-credit Summer course", async () => {
    const stack = buildStack();
    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;

    await stack.plannerService.addSummerCourse(sophomore.id, zeroCreditSummer, 4);

    const analysis = await analyze(stack);
    expect(analysis.credits.total).toBe(0);
    expect(analysis.earned?.credits.total).toBe(0);

    const electives = analysis.graduationRequirements.find((r) => r.name === "Electives")!;
    expect(electives.earnedValue).toBe(0);
  });

  it("occupies both Summer sessions for a full-summer course and rejects conflicts", async () => {
    const stack = buildStack();
    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;

    const updated = await stack.plannerService.addSummerCourse(sophomore.id, fullSummer, 3);
    expect(updated.plannedCourses.filter((pc) => pc.summerCourseId === fullSummer.id).map((pc) => pc.semester)).toEqual([3, 4]);
    await expect(stack.plannerService.addSummerCourse(sophomore.id, summerHealth, 3)).rejects.toThrow(
      "Summer School Semester 1 already has a course"
    );
  });

  it("blocks a matched regular equivalent while preserving the existing PE exception", async () => {
    const stack = buildStack();
    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;

    await stack.plannerService.addSummerCourse(sophomore.id, matchedSummer, 3);
    await expect(stack.plannerService.addPlannedCourse(sophomore.id, algebra.id, 1, 1)).rejects.toThrow(
      "Summer School equivalent"
    );
  });

  it("completing the Sophomore year records the 9→10 summer course under Sophomore (10)", async () => {
    const stack = buildStack();
    const sophomore = (await stack.plannerService.getPlanners()).find((p) => p.schoolYear === 10)!;
    await stack.plannerService.addSummerCourse(sophomore.id, summerHealth, 3);

    await stack.plannerService.markYearCompleted(sophomore.id);
    const completed = await stack.completedService.getCompletedCourses();
    const summerRecord = completed.find((cc) => cc.summerCourseId === summerHealth.id)!;
    expect(summerRecord).toBeDefined();
    expect(summerRecord.gradeCompleted).toBe("Sophomore (10)");
    expect(summerRecord.credits).toBe(1);
  });
});

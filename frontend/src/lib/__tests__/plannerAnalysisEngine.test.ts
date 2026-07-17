import { describe, it, expect } from "vitest";
import { computePlannerAnalysis } from "@/lib/plannerAnalysisEngine";
import type { Planner, PlannerCourseDetails } from "@/lib/planner";
import type { CompletedCourse, GradeCompleted } from "@/lib/completedCourses";
import type { RequirementResolution } from "@/lib/api";

const chemistry: PlannerCourseDetails = {
  id: 101, title: "Chemistry", normalizedTitle: "chemistry", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Science",
  department: "Science", description: null, fulfillsRequirements: ["Science", "Lab Science"],
  prerequisites: [], courseCode: "SCI101", gradeMin: 10, gradeMax: 12,
  isNonAcademic: false, isMarchingBand: false,
};

const algebra: PlannerCourseDetails = {
  id: 201, title: "Algebra I", normalizedTitle: "algebra i", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Mathematics",
  department: "Mathematics", description: null, fulfillsRequirements: ["Mathematics"],
  prerequisites: [], courseCode: "MATH101", gradeMin: 9, gradeMax: 9,
  isNonAcademic: false, isMarchingBand: false,
};

const english9: PlannerCourseDetails = {
  id: 301, title: "English I", normalizedTitle: "english i", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "English",
  department: "English", description: null, fulfillsRequirements: ["English"],
  prerequisites: [], courseCode: "ENG101", gradeMin: 9, gradeMax: 9,
  isNonAcademic: false, isMarchingBand: false,
};

const english10: PlannerCourseDetails = {
  id: 302, title: "English II", normalizedTitle: "english ii", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "English",
  department: "English", description: null, fulfillsRequirements: ["English"],
  prerequisites: [], courseCode: "ENG102", gradeMin: 10, gradeMax: 10,
  isNonAcademic: false, isMarchingBand: false,
};

const usHistory: PlannerCourseDetails = {
  id: 401, title: "U.S. History", normalizedTitle: "u.s. history", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Social Studies",
  department: "Social Studies", description: null, fulfillsRequirements: ["U.S. History", "Social Studies"],
  prerequisites: [], courseCode: "HIST201", gradeMin: 11, gradeMax: 11,
  isNonAcademic: false, isMarchingBand: false,
};

const government: PlannerCourseDetails = {
  id: 402, title: "Government", normalizedTitle: "government", duration: 1,
  slotsPerSemester: 1, creditType: "regular", credits: 0.5, division: "Social Studies",
  department: "Social Studies", description: null, fulfillsRequirements: ["Government", "Social Studies"],
  prerequisites: [], courseCode: "GOV201", gradeMin: 12, gradeMax: 12,
  isNonAcademic: false, isMarchingBand: false,
};

const peCourse: PlannerCourseDetails = {
  id: 501, title: "Physical Education I", normalizedTitle: "physical education i", duration: 1,
  slotsPerSemester: 1, creditType: "regular", credits: 0.5, division: "Physical Education",
  department: "Physical Education", description: null, fulfillsRequirements: ["Physical Education"],
  prerequisites: [], courseCode: "PE101", gradeMin: 9, gradeMax: 12,
  isNonAcademic: false, isMarchingBand: false,
};

const health: PlannerCourseDetails = {
  id: 601, title: "Health", normalizedTitle: "health", duration: 1,
  slotsPerSemester: 1, creditType: "regular", credits: 0.5, division: "Health",
  department: "Health", description: null, fulfillsRequirements: ["Health"],
  prerequisites: [], courseCode: "HLT101", gradeMin: 10, gradeMax: 10,
  isNonAcademic: false, isMarchingBand: false,
};

const allCourses = [chemistry, algebra, english9, english10, usHistory, government, peCourse, health];

function makePlanner(year: number, planned: Planner["plannedCourses"] = []): Planner {
  const id = year - 8; // 9→1, 10→2, 11→3, 12→4
  return { id, schoolYear: year, label: String(year), plannedCourses: planned };
}

function makePlanned(course: PlannerCourseDetails, semester: number, slot: number, plannedId?: number): Planner["plannedCourses"][number] {
  return {
    id: plannedId ?? course.id,
    plannerId: 0,
    courseId: course.id,
    plannerOptionId: null,
    semester,
    slot,
    slotSpan: 1,
    course: { ...course },
  };
}

function makeCompleted(course: PlannerCourseDetails, grade: GradeCompleted): CompletedCourse {
  return {
    id: course.id,
    userId: -1,
    courseId: course.id,
    gradeCompleted: grade,
    letterGrade: null,
    credits: null,
    course: { ...course },
  };
}

describe("computePlannerAnalysis", () => {
  it("empty planners produce zero credits", () => {
    const result = computePlannerAnalysis({
      planners: [makePlanner(9), makePlanner(10), makePlanner(11), makePlanner(12)],
      completedCourses: [],
      resolutions: [],
      allCourses,
    });
    expect(result.credits.total).toBe(0);
    expect(result.plannerStatistics.coursesScheduled).toBe(0);
  });

  it("computes credits correctly for a single course", () => {
    const planners = [
      makePlanner(9, [makePlanned(algebra, 1, 1)]),
      makePlanner(10), makePlanner(11), makePlanner(12),
    ];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses });
    expect(result.credits.total).toBe(2);
    expect(result.credits.byDivision["Mathematics"]).toBe(2);
    expect(result.credits.byRequirementCategory["Mathematics"]).toBe(2);
  });

  it("full-year course counts once per year", () => {
    const planners = [
      makePlanner(9, [makePlanned(algebra, 1, 1, 1), makePlanned(algebra, 2, 1, 1)]),
      makePlanner(10), makePlanner(11), makePlanner(12),
    ];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses });
    expect(result.credits.total).toBe(2);
  });

  it("finds year requirements", () => {
    const semester1 = [
      makePlanned(algebra, 1, 1, 1),
      makePlanned(algebra, 2, 1, 1),
      makePlanned(english9, 1, 2, 2),
      makePlanned(english9, 2, 2, 2),
    ];
    const planners = [
      makePlanner(9, semester1),
      makePlanner(10), makePlanner(11), makePlanner(12),
    ];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses });
    const year9 = result.yearRequirements.find((y) => y.grade === 9)!;
    expect(year9).toBeDefined();
    expect(year9.items.find((i) => i.category === "Mathematics")!.met).toBe(true);
    expect(year9.items.find((i) => i.category === "Communication Arts")!.met).toBe(true);
    expect(year9.items.find((i) => i.category === "Science")!.met).toBe(false);
  });

  it("computes graduation requirements progress", () => {
    const semester1 = [
      makePlanned(algebra, 1, 1, 1), makePlanned(algebra, 2, 1, 1),
      makePlanned(english9, 1, 2, 2), makePlanned(english9, 2, 2, 2),
    ];
    const planners = [
      makePlanner(9, semester1),
      makePlanner(10), makePlanner(11), makePlanner(12),
    ];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses });
    const math = result.graduationRequirements.find((r) => r.name === "Mathematics")!;
    expect(math.earnedValue).toBe(2);
    expect(math.requiredValue).toBe(3);
    expect(math.status).toBe("partial");
    const eng = result.graduationRequirements.find((r) => r.name === "English")!;
    expect(eng.earnedValue).toBe(2);
    expect(eng.requiredValue).toBe(4);
  });

  it("full four-year plan satisfies graduation requirements", () => {
    const y9 = [
      makePlanned(algebra, 1, 1, 1), makePlanned(algebra, 2, 1, 1),
      makePlanned(english9, 1, 2, 2), makePlanned(english9, 2, 2, 2),
      makePlanned(peCourse, 1, 3, 3), makePlanned(peCourse, 2, 3, 4),
    ];
    const y10 = [
      makePlanned(english10, 1, 1, 5), makePlanned(english10, 2, 1, 5),
      makePlanned(peCourse, 1, 2, 6), makePlanned(peCourse, 2, 2, 7),
      makePlanned(health, 1, 3, 8),
    ];
    const y11 = [
      makePlanned(usHistory, 1, 1, 9), makePlanned(usHistory, 2, 1, 9),
      makePlanned(peCourse, 1, 2, 10), makePlanned(peCourse, 2, 2, 11),
    ];
    const y12 = [
      makePlanned(government, 1, 1, 12),
      makePlanned(peCourse, 1, 2, 13), makePlanned(peCourse, 2, 2, 14),
    ];
    const planners = [makePlanner(9, y9), makePlanner(10, y10), makePlanner(11, y11), makePlanner(12, y12)];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses });

    expect(result.credits.total).toBeGreaterThan(0);
    const eng = result.graduationRequirements.find((r) => r.name === "English")!;
    expect(eng.status).toBe("satisfied");
    const mathResult = result.graduationRequirements.find((r) => r.name === "Mathematics")!;
    expect(mathResult.earnedValue).toBe(2);
    const usHistoryReq = result.graduationRequirements.find((r) => r.name === "U.S. History")!;
    expect(usHistoryReq.status).toBe("satisfied");
    const govReq = result.graduationRequirements.find((r) => r.name === "Government")!;
    expect(govReq.status).toBe("satisfied");
  });

  it("PE waiver marks all PE semesters as met", () => {
    const planners = [makePlanner(9), makePlanner(10), makePlanner(11), makePlanner(12)];
    const resolutions: RequirementResolution[] = [
      { id: 1, userId: -1, type: "pe_waiver", courseId: null, metadata: { variant: "academic" }, createdAt: "", updatedAt: "" },
    ];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions, allCourses });
    for (const sem of result.peSemesterBreakdown) {
      expect(sem.met).toBe(true);
    }
    const pe = result.graduationRequirements.find((r) => r.name === "Physical Education")!;
    expect(pe.remainingValue).toBe(0);
  });

  it("PE semester breakdown shows correct required labels", () => {
    const planners = [
      makePlanner(9, [makePlanned(peCourse, 1, 1, 1), makePlanned(peCourse, 2, 1, 2)]),
      makePlanner(10, [makePlanned(health, 1, 1, 3)]),
      makePlanner(11),
      makePlanner(12),
    ];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses });
    expect(result.peSemesterBreakdown[0].met).toBe(false); // Foundational Fitness — not met
    expect(result.peSemesterBreakdown[1].met).toBe(true);  // PE — met by peCourse
    expect(result.peSemesterBreakdown[2].met).toBe(true);  // Health — met
    expect(result.peSemesterBreakdown[3].met).toBe(false); // PE/Applied Health — not met
  });

  it("detects duplicate courses", () => {
    const planners = [
      makePlanner(9, [makePlanned(algebra, 1, 1, 1), makePlanned(algebra, 2, 1, 1)]),
      makePlanner(10, [makePlanned(algebra, 1, 1, 2), makePlanned(algebra, 2, 1, 2)]),
      makePlanner(11), makePlanner(12),
    ];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses });
    const dup = result.duplicateCourses.find((d) => d.courseId === algebra.id);
    expect(dup).toBeDefined();
    expect(dup!.count).toBe(2);
  });

  it("detects missing prerequisites", () => {
    // Chemistry requires no prereqs in test data, so no missing prereqs
    // Let's test with a course that has prerequisites
    const chemWithPrereq: PlannerCourseDetails = {
      ...chemistry,
      prerequisites: ["Algebra I"],
    };
    const courses = allCourses.map((c) => c.id === chemistry.id ? chemWithPrereq : c);
    const planners = [
      makePlanner(9),
      makePlanner(10, [makePlanned(chemWithPrereq, 1, 1, 1)]),
      makePlanner(11), makePlanner(12),
    ];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses: courses });
    expect(result.missingPrerequisites.length).toBeGreaterThan(0);
    expect(result.missingPrerequisites[0].missingPrerequisite).toBe("Algebra I");
    expect(result.missingPrerequisites[0].reason).toBe("notPlanned");
  });

  it("completed courses satisfy prerequisites", () => {
    const chemWithPrereq: PlannerCourseDetails = {
      ...chemistry,
      prerequisites: ["Algebra I"],
    };
    const courses = allCourses.map((c) => c.id === chemistry.id ? chemWithPrereq : c);
    const planners = [
      makePlanner(9),
      makePlanner(10, [makePlanned(chemWithPrereq, 1, 1, 1)]),
      makePlanner(11), makePlanner(12),
    ];
    const completed = [makeCompleted(algebra, "completed")];
    const result = computePlannerAnalysis({ planners, completedCourses: completed, resolutions: [], allCourses: courses });
    expect(result.missingPrerequisites).toHaveLength(0);
  });

  it("planner statistics are correct", () => {
    const planners = [
      makePlanner(9, [makePlanned(algebra, 1, 1, 1)]),
      makePlanner(10), makePlanner(11), makePlanner(12),
    ];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses });
    expect(result.plannerStatistics.coursesScheduled).toBe(1);
    // 4 years * 2 semesters * 7 slots = 56 total. 1 occupied.
    expect(result.plannerStatistics.freeSlotsRemaining).toBe(55);
  });

  it("guest and auth analysis services produce data in same shape", () => {
    // The auth service calls the backend; the guest service uses the engine.
    // Both return PlannerAnalysis. This test verifies the engine produces
    // the correct shape for a simple case.
    const planners = [makePlanner(9), makePlanner(10), makePlanner(11), makePlanner(12)];
    const result = computePlannerAnalysis({ planners, completedCourses: [], resolutions: [], allCourses });
    expect(result).toHaveProperty("credits");
    expect(result).toHaveProperty("graduationRequirements");
    expect(result).toHaveProperty("yearRequirements");
    expect(result).toHaveProperty("peSemesterBreakdown");
    expect(result).toHaveProperty("duplicateCourses");
    expect(result).toHaveProperty("missingPrerequisites");
    expect(result).toHaveProperty("plannerStatistics");
    expect(result).toHaveProperty("resolutions");
    expect(Array.isArray(result.graduationRequirements)).toBe(true);
    expect(Array.isArray(result.yearRequirements)).toBe(true);
    expect(result.yearRequirements).toHaveLength(4);
  });
});

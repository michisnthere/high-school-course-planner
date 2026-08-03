import { describe, it, expect } from "vitest";
import type { Planner, PlannerCourseDetails, PlannedCourse } from "@/lib/planner";
import { calculatePlannerOccupancy, TOTAL_PLANNER_SLOTS } from "@/lib/plannerOccupancy";

function makeCourse(overrides: Partial<PlannerCourseDetails>): PlannerCourseDetails {
  return {
    id: 1,
    title: "Test Course",
    normalizedTitle: "test course",
    duration: 1,
    slotsPerSemester: 1,
    creditType: null,
    credits: 1,
    division: "Mathematics",
    department: "Mathematics",
    description: null,
    fulfillsRequirements: [],
    prerequisites: [],
    courseCode: null,
    courseCodeS1: null,
    courseCodeS2: null,
    gradeMin: null,
    gradeMax: null,
    isNonAcademic: false,
    isMarchingBand: false,
    attributes: [],
    supportsEarlyBird: false,
    isRepeatable: false,
    ...overrides,
  };
}

function makePlanned(overrides: Partial<PlannedCourse> & { course?: PlannerCourseDetails }): PlannedCourse {
  return {
    id: 1,
    plannerId: 1,
    courseId: null,
    plannerOptionId: null,
    semester: 1,
    slot: 1,
    slotSpan: 1,
    course: makeCourse({}),
    isEarlyBird: false,
    ...overrides,
  };
}

function makePlanner(schoolYear: number, plannedCourses: PlannedCourse[]): Planner {
  return { id: schoolYear - 8, schoolYear, label: String(schoolYear), completedAt: null, plannedCourses };
}

describe("calculatePlannerOccupancy", () => {
  it("returns zeroed occupancy for an empty planner", () => {
    const occ = calculatePlannerOccupancy(makePlanner(11, []));
    expect(occ.filledSlots).toBe(0);
    expect(occ.totalSlots).toBe(14);
    expect(occ.availableSlots).toBe(14);
    expect(occ.plannedCount).toBe(0);
    expect(occ.occupiedPeriods).toEqual({ 1: [], 2: [] });
  });

  it("counts a full-year course once for plannedCount but two slots for occupancy", () => {
    const fy = makeCourse({ id: 10, title: "English", duration: 2 });
    const planner = makePlanner(11, [
      makePlanned({ id: 1, courseId: 10, course: fy, semester: 1, slot: 1 }),
      makePlanned({ id: 2, courseId: 10, course: fy, semester: 2, slot: 1 }),
    ]);
    const occ = calculatePlannerOccupancy(planner);
    expect(occ.filledSlots).toBe(2);
    expect(occ.plannedCount).toBe(1);
    expect(occ.fullYearCount).toBe(1);
    expect(occ.semesterCount).toBe(0);
  });

  it("counts American Studies multi-slot occupancy exactly as the year planner grid does", () => {
    const amStud = makeCourse({
      id: 20,
      title: "American Studies",
      duration: 2,
      slotsPerSemester: 2,
    });
    const planner = makePlanner(11, [
      makePlanned({ id: 3, courseId: 20, course: amStud, semester: 1, slot: 2, slotSpan: 2 }),
      makePlanned({ id: 4, courseId: 20, course: amStud, semester: 2, slot: 2, slotSpan: 2 }),
    ]);
    const occ = calculatePlannerOccupancy(planner);
    expect(occ.filledSlots).toBe(4);
    expect(occ.plannedCount).toBe(1);
    expect(occ.multiSlotCount).toBe(1);
    expect(occ.occupiedPeriods[1]).toEqual([2, 3]);
    expect(occ.occupiedPeriods[2]).toEqual([2, 3]);
  });

  it("treats an Early Bird course as a single occupied slot", () => {
    const apPhysics = makeCourse({
      id: 30,
      title: "AP Physics 1",
      duration: 1,
      credits: 1.5,
      slotsPerSemester: 1,
      division: "Science",
      description: "1.5 period course",
    });
    const planner = makePlanner(11, [
      makePlanned({ id: 5, courseId: 30, course: apPhysics, semester: 1, slot: 4, isEarlyBird: true }),
    ]);
    const occ = calculatePlannerOccupancy(planner);
    expect(occ.filledSlots).toBe(1);
    expect(occ.earlyBirdCount).toBe(1);
    expect(occ.plannedCount).toBe(1);
  });

  it("excludes summer school courses from regular-slot math", () => {
    const summer = makeCourse({ id: 40, title: "Summer English", duration: 1 });
    const planner = makePlanner(11, [
      makePlanned({ id: 6, courseId: 40, course: summer, semester: 3, slot: 1 }),
    ]);
    const occ = calculatePlannerOccupancy(planner);
    expect(occ.filledSlots).toBe(0);
    expect(occ.summerCourseCount).toBe(1);
    expect(occ.totalSlots).toBe(TOTAL_PLANNER_SLOTS);
  });

  it("counts distinct one-semester courses across both semesters", () => {
    const health = makeCourse({ id: 50, title: "Health", duration: 1 });
    const gov = makeCourse({ id: 51, title: "Government", duration: 1 });
    const planner = makePlanner(12, [
      makePlanned({ id: 7, courseId: 50, course: health, semester: 1, slot: 1 }),
      makePlanned({ id: 8, courseId: 51, course: gov, semester: 2, slot: 1 }),
    ]);
    const occ = calculatePlannerOccupancy(planner);
    expect(occ.filledSlots).toBe(2);
    expect(occ.plannedCount).toBe(2);
    expect(occ.semesterCount).toBe(2);
    expect(occ.fullYearCount).toBe(0);
  });
});

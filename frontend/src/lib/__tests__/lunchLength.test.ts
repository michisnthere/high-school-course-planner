import { describe, it, expect } from "vitest";
import type { PlannerCourseDetails, PlannedCourse } from "@/lib/planner";
import { computeLunchLength } from "@/lib/courseLoadRequirements";

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

function makeScienceCourse(overrides: Partial<PlannerCourseDetails> = {}): PlannerCourseDetails {
  return makeCourse({
    id: 1,
    title: "AP Biology",
    division: "Science",
    department: "Science",
    description: "1.5 period science course",
    credits: 1.5,
    supportsEarlyBird: true,
    ...overrides,
  });
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

describe("computeLunchLength", () => {
  it("returns Full Lunch for both semesters when no courses exist", () => {
    const result = computeLunchLength([]);
    expect(result.semesters).toEqual([
      { semester: 1, lunchLength: "Full Lunch" },
      { semester: 2, lunchLength: "Full Lunch" },
    ]);
  });

  it("returns Full Lunch when no 1.5-period science courses exist", () => {
    const courses = [
      makePlanned({ semester: 1, course: makeCourse({ id: 1, division: "Mathematics" }) }),
      makePlanned({ semester: 2, course: makeCourse({ id: 2, division: "English" }) }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Full Lunch");
    expect(result.semesters[1].lunchLength).toBe("Full Lunch");
  });

  it("returns Half Lunch for one non-Early Bird 1.5-period science course", () => {
    const courses = [
      makePlanned({
        semester: 1,
        course: makeScienceCourse(),
        isEarlyBird: false,
      }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Half Lunch");
  });

  it("returns Full Lunch for one Early Bird 1.5-period science course", () => {
    const courses = [
      makePlanned({
        semester: 1,
        course: makeScienceCourse(),
        isEarlyBird: true,
      }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Full Lunch");
  });

  it("returns Half Lunch for two 1.5-period science courses with different Early Bird statuses", () => {
    const courses = [
      makePlanned({
        id: 1,
        semester: 1,
        course: makeScienceCourse({ id: 1 }),
        isEarlyBird: true,
      }),
      makePlanned({
        id: 2,
        semester: 1,
        course: makeScienceCourse({ id: 2 }),
        isEarlyBird: false,
      }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Half Lunch");
  });

  it("returns Full Lunch for two 1.5-period science courses both Early Bird", () => {
    const courses = [
      makePlanned({
        id: 1,
        semester: 1,
        course: makeScienceCourse({ id: 1 }),
        isEarlyBird: true,
      }),
      makePlanned({
        id: 2,
        semester: 1,
        course: makeScienceCourse({ id: 2 }),
        isEarlyBird: true,
      }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Full Lunch");
  });

  it("returns Half Lunch for two 1.5-period science courses both non-Early Bird", () => {
    const courses = [
      makePlanned({
        id: 1,
        semester: 1,
        course: makeScienceCourse({ id: 1 }),
        isEarlyBird: false,
      }),
      makePlanned({
        id: 2,
        semester: 1,
        course: makeScienceCourse({ id: 2 }),
        isEarlyBird: false,
      }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Half Lunch");
  });

  it("does not affect lunch length with a 1.5-period non-science course", () => {
    const courses = [
      makePlanned({
        semester: 1,
        course: makeCourse({
          id: 1,
          division: "English",
          description: "1.5 period course",
          credits: 1.5,
        }),
        isEarlyBird: false,
      }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Full Lunch");
  });

  it("calculates each semester independently", () => {
    const courses = [
      makePlanned({
        id: 1,
        semester: 1,
        course: makeScienceCourse({ id: 1 }),
        isEarlyBird: false,
      }),
      makePlanned({
        id: 2,
        semester: 2,
        course: makeScienceCourse({ id: 2 }),
        isEarlyBird: true,
      }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Half Lunch");
    expect(result.semesters[1].lunchLength).toBe("Full Lunch");
  });

  it("ignores summer and online semester courses", () => {
    const courses = [
      makePlanned({
        semester: 3,
        course: makeScienceCourse({ id: 1 }),
        isEarlyBird: false,
      }),
      makePlanned({
        semester: 5,
        course: makeScienceCourse({ id: 2 }),
        isEarlyBird: false,
      }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Full Lunch");
    expect(result.semesters[1].lunchLength).toBe("Full Lunch");
  });

  it("handles adding a course that changes lunch length", () => {
    const courses1 = [
      makePlanned({
        semester: 1,
        course: makeScienceCourse(),
        isEarlyBird: true,
      }),
    ];
    const result1 = computeLunchLength(courses1);
    expect(result1.semesters[0].lunchLength).toBe("Full Lunch");

    const courses2 = [
      makePlanned({
        id: 1,
        semester: 1,
        course: makeScienceCourse({ id: 1 }),
        isEarlyBird: true,
      }),
      makePlanned({
        id: 2,
        semester: 1,
        course: makeScienceCourse({ id: 2 }),
        isEarlyBird: false,
      }),
    ];
    const result2 = computeLunchLength(courses2);
    expect(result2.semesters[0].lunchLength).toBe("Half Lunch");
  });

  it("handles missing or invalid period-length data safely", () => {
    const courses = [
      makePlanned({
        semester: 1,
        course: makeCourse({
          id: 1,
          division: "Science",
          department: "Science",
          description: null,
          credits: null,
          options: null,
        }),
        isEarlyBird: false,
      }),
    ];
    const result = computeLunchLength(courses);
    expect(result.semesters[0].lunchLength).toBe("Full Lunch");
  });
});

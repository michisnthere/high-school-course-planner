import { describe, it, expect } from "vitest";
import { hasGuestProgress } from "@/lib/guestProgress";
import type { Planner } from "@/lib/planner";
import type { CompletedCourse } from "@/lib/completedCourses";
import type { RequirementResolution } from "@/lib/api";

describe("hasGuestProgress", () => {
  const emptyPlanners: Planner[] = [
    { id: 1, schoolYear: 9, plannedCourses: [] },
    { id: 2, schoolYear: 10, plannedCourses: [] },
    { id: 3, schoolYear: 11, plannedCourses: [] },
    { id: 4, schoolYear: 12, plannedCourses: [] },
  ];

  const emptyCompleted: CompletedCourse[] = [];
  const emptySaved: number[] = [];
  const emptyResolutions: RequirementResolution[] = [];

  it("returns false when all data is empty", () => {
    expect(hasGuestProgress(emptyPlanners, emptyCompleted, emptySaved, emptyResolutions)).toBe(false);
  });

  it("returns true when a planner has a planned course", () => {
    const plannersWithCourse: Planner[] = [
      ...emptyPlanners.slice(0, 3),
      {
        id: 4,
        schoolYear: 12,
        plannedCourses: [
          {
            id: 1,
            plannerId: 4,
            course: { id: 100, title: "Physics", duration: 2, slotsPerSemester: 1, creditType: "regular", credits: 2, isNonAcademic: false, isMarchingBand: false },
            courseId: 100,
            semester: 1,
            slot: 1,
          },
        ],
      },
    ];
    expect(hasGuestProgress(plannersWithCourse, emptyCompleted, emptySaved, emptyResolutions)).toBe(true);
  });

  it("returns true when there are completed courses", () => {
    const completed: CompletedCourse[] = [
      { id: 1, courseId: 100, gradeCompleted: "A", letterGrade: "A" },
    ];
    expect(hasGuestProgress(emptyPlanners, completed, emptySaved, emptyResolutions)).toBe(true);
  });

  it("returns true when there are saved course IDs", () => {
    expect(hasGuestProgress(emptyPlanners, emptyCompleted, [42, 99], emptyResolutions)).toBe(true);
  });

  it("returns true when there are resolutions", () => {
    const resolutions: RequirementResolution[] = [
      { id: 1, type: "pe_waiver", userId: -1, courseId: null, metadata: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    expect(hasGuestProgress(emptyPlanners, emptyCompleted, emptySaved, resolutions)).toBe(true);
  });

  it("returns true when multiple sources have data", () => {
    const plannersWithCourse: Planner[] = [
      {
        id: 1, schoolYear: 9,
        plannedCourses: [{
          id: 1, plannerId: 1,
          course: { id: 101, title: "Algebra I", duration: 2, slotsPerSemester: 1, creditType: "regular", credits: 2, isNonAcademic: false, isMarchingBand: false },
          courseId: 101, semester: 1, slot: 1,
        }],
      },
      { id: 2, schoolYear: 10, plannedCourses: [] },
      { id: 3, schoolYear: 11, plannedCourses: [] },
      { id: 4, schoolYear: 12, plannedCourses: [] },
    ];
    expect(hasGuestProgress(plannersWithCourse, emptyCompleted, [55], emptyResolutions)).toBe(true);
  });

  it("returns false with only empty planners and no other data", () => {
    const todosEmptyPlanners: Planner[] = [
      { id: 1, schoolYear: 9, plannedCourses: [] },
    ];
    expect(hasGuestProgress(todosEmptyPlanners, emptyCompleted, emptySaved, emptyResolutions)).toBe(false);
  });
});

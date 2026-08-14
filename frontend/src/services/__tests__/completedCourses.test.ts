import { describe, it, expect, beforeAll } from "vitest";
import {
  GRADE_COMPLETED_OPTIONS,
  type GradeCompleted,
} from "@/lib/completedCourses";
import type { SummerCourse } from "@/lib/summerCourse";
import { REGULAR_GRADE_COMPLETED_OPTIONS, SUMMER_GRADE_COMPLETED_OPTIONS } from "@/lib/completedCoursePeriods";
import { createGuestCompletedCoursesService } from "@/services/completedCourses";

beforeAll(() => {
  (globalThis as any).window ??= {};
  (globalThis as any).window.dispatchEvent ??= () => true;
});

function makeSummerCourse(id: number): SummerCourse {
  return {
    id,
    key: `summer-${id}`,
    title: `Summer Course ${id}`,
    courseCode: `SUM-${id}`,
    creditStatus: "credit",
    credits: 1,
    duration: "one_session",
    prerequisites: [],
    fulfillsRequirements: [],
    isSummerOnly: true,
    regularCourseId: null,
    regularCourse: null,
    gradeLevels: [10],
    sessions: ["Session 1"],
  } as SummerCourse;
}

describe("guest completed courses service", () => {
  it("persists every canonical academic period value exactly, split by course context", async () => {
    const svc = createGuestCompletedCoursesService();

    const regularCreated = await Promise.all(
      REGULAR_GRADE_COMPLETED_OPTIONS.map((gradeCompleted, index) =>
        svc.addCompletedCourse(index + 1, gradeCompleted)
      )
    );
    const summerCreated = await Promise.all(
      SUMMER_GRADE_COMPLETED_OPTIONS.map((gradeCompleted, index) =>
        svc.addCompletedCourse({
          summerCourseId: 100 + index,
          gradeCompleted,
          summerCourse: makeSummerCourse(100 + index),
        })
      )
    );

    expect(regularCreated.map((course) => course.gradeCompleted)).toEqual([
      "Middle School",
      "Freshman (9)",
      "Sophomore (10)",
      "Junior (11)",
      "Senior (12)",
    ]);
    expect(summerCreated.map((course) => course.gradeCompleted)).toEqual([
      "Summer School",
      "Freshman Summer",
      "Sophomore Summer",
      "Junior Summer",
      "Senior Summer",
    ]);

    const stored = await svc.getCompletedCourses();
    const storedGrades = stored.map((course) => course.gradeCompleted);
    // No coercion: the union of what was stored equals the canonical list.
    expect([...new Set(storedGrades)].sort()).toEqual([...GRADE_COMPLETED_OPTIONS].sort());
    // Summer records are summer-specific; regular records are regular.
    expect(stored.filter((c) => c.summerCourseId != null).every((c) => SUMMER_GRADE_COMPLETED_OPTIONS.includes(c.gradeCompleted))).toBe(true);
    expect(stored.filter((c) => c.courseId != null).every((c) => REGULAR_GRADE_COMPLETED_OPTIONS.includes(c.gradeCompleted))).toBe(true);
  });

  it("rejects a regular course recorded in a Summer-specific period", async () => {
    const svc = createGuestCompletedCoursesService();
    await expect(svc.addCompletedCourse(1, "Freshman Summer" as GradeCompleted)).rejects.toThrow(
      "Regular courses cannot be marked completed"
    );
  });

  it("rejects a Summer School course recorded in a regular period", async () => {
    const svc = createGuestCompletedCoursesService();
    await expect(
      svc.addCompletedCourse({
        summerCourseId: 100,
        gradeCompleted: "Freshman (9)",
        summerCourse: makeSummerCourse(100),
      })
    ).rejects.toThrow("Summer School courses must be marked completed in a Summer-specific period");
  });

  it("rejects an edit that would move a completed course into the wrong context", async () => {
    const svc = createGuestCompletedCoursesService();
    await svc.addCompletedCourse(1, "Freshman (9)");
    await svc.addCompletedCourse({
      summerCourseId: 100,
      gradeCompleted: "Freshman Summer",
      summerCourse: makeSummerCourse(100),
    });
    const stored = await svc.getCompletedCourses();

    const regularId = stored.find((c) => c.courseId != null)!.id;
    const summerId = stored.find((c) => c.summerCourseId != null)!.id;

    await expect(
      svc.updateCompletedCourse(regularId, { gradeCompleted: "Freshman Summer" as GradeCompleted })
    ).rejects.toThrow("Regular courses cannot be marked completed");
    await expect(
      svc.updateCompletedCourse(summerId, { gradeCompleted: "Freshman (9)" as GradeCompleted })
    ).rejects.toThrow("Summer School courses must keep a Summer-specific period");
  });
});
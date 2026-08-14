import { describe, it, expect, beforeAll } from "vitest";
import type { GradeCompleted } from "@/lib/completedCourses";
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
      "Middle School Summer",
      "Freshman Summer",
      "Sophomore Summer",
      "Junior Summer",
      "Senior Summer",
    ]);

    const stored = await svc.getCompletedCourses();
    const storedGrades = stored.map((course) => course.gradeCompleted);
    // No coercion: the union of the selectable values is stored exactly. The
    // legacy "Summer School" value is exercised separately (it is not offered
    // in any selector).
    const selectable = new Set<string>([...REGULAR_GRADE_COMPLETED_OPTIONS, ...SUMMER_GRADE_COMPLETED_OPTIONS]);
    expect([...new Set(storedGrades)].sort()).toEqual([...selectable].sort());
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

  it("round-trips a Summer School course saved as Freshman Summer", async () => {
    const svc = createGuestCompletedCoursesService();
    await svc.addCompletedCourse({
      summerCourseId: 100,
      gradeCompleted: "Freshman Summer",
      summerCourse: makeSummerCourse(100),
    });
    const stored = await svc.getCompletedCourses();
    expect(stored.find((c) => c.summerCourseId === 100)?.gradeCompleted).toBe("Freshman Summer");
  });

  it("round-trips a regular course saved as Freshman and keeps contexts separate on edit", async () => {
    const svc = createGuestCompletedCoursesService();
    await svc.addCompletedCourse(1, "Freshman (9)");
    await svc.addCompletedCourse({
      summerCourseId: 100,
      gradeCompleted: "Middle School Summer",
      summerCourse: makeSummerCourse(100),
    });
    let stored = await svc.getCompletedCourses();

    const regularId = stored.find((c) => c.courseId != null)!.id;
    const summerId = stored.find((c) => c.summerCourseId != null)!.id;

    expect(stored.find((c) => c.courseId === 1)?.gradeCompleted).toBe("Freshman (9)");
    expect(stored.find((c) => c.summerCourseId === 100)?.gradeCompleted).toBe("Middle School Summer");

    // Edit within the correct context: regular stays regular, summer stays summer.
    await svc.updateCompletedCourse(regularId, { gradeCompleted: "Sophomore (10)" as GradeCompleted });
    await svc.updateCompletedCourse(summerId, { gradeCompleted: "Freshman Summer" as GradeCompleted });
    stored = await svc.getCompletedCourses();
    expect(stored.find((c) => c.id === regularId)?.gradeCompleted).toBe("Sophomore (10)");
    expect(stored.find((c) => c.id === summerId)?.gradeCompleted).toBe("Freshman Summer");
  });

  it("still accepts the legacy generic Summer School grade for existing summer records", async () => {
    const svc = createGuestCompletedCoursesService();
    await svc.addCompletedCourse({
      summerCourseId: 100,
      gradeCompleted: "Summer School",
      summerCourse: makeSummerCourse(100),
    });
    const stored = await svc.getCompletedCourses();
    expect(stored.find((c) => c.summerCourseId === 100)?.gradeCompleted).toBe("Summer School");
  });
});
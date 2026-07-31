import { describe, it, expect, beforeAll } from "vitest";
import {
  GRADE_COMPLETED_OPTIONS,
  type GradeCompleted,
} from "@/lib/completedCourses";
import { createGuestCompletedCoursesService } from "@/services/completedCourses";

beforeAll(() => {
  (globalThis as any).window ??= {};
  (globalThis as any).window.dispatchEvent ??= () => true;
});

describe("guest completed courses service", () => {
  it("preserves academic period values exactly", async () => {
    const svc = createGuestCompletedCoursesService();

    const created = await Promise.all(
      GRADE_COMPLETED_OPTIONS.map((gradeCompleted, index) =>
        svc.addCompletedCourse(index + 1, gradeCompleted as GradeCompleted)
      )
    );

    expect(created.map((course) => course.gradeCompleted)).toEqual([
      "Middle School",
      "Summer School",
      "Freshman (9)",
      "Freshman Summer",
      "Sophomore (10)",
      "Sophomore Summer",
      "Junior (11)",
      "Junior Summer",
      "Senior (12)",
      "Senior Summer",
    ]);

    const stored = await svc.getCompletedCourses();
    expect(stored.map((course) => course.gradeCompleted)).toEqual([
      "Middle School",
      "Summer School",
      "Freshman (9)",
      "Freshman Summer",
      "Sophomore (10)",
      "Sophomore Summer",
      "Junior (11)",
      "Junior Summer",
      "Senior (12)",
      "Senior Summer",
    ]);
  });
});

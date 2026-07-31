import { describe, it, expect } from "vitest";
import {
  getEligibleCompletedGrades,
  getDefaultCompletedGrade,
  GRADE_COMPLETED_OPTIONS,
} from "@/lib/completedCourses";

describe("completed course eligibility", () => {
  it("returns only middle school when planning freshman year", () => {
    expect(getEligibleCompletedGrades(9)).toEqual(["Middle School"]);
  });

  it("excludes current and future years when planning sophomore", () => {
    expect(getEligibleCompletedGrades(10)).toEqual([
      "Middle School",
      "Freshman (9)",
      "Freshman Summer",
    ]);
  });

  it("includes all periods before junior year but not junior or senior", () => {
    expect(getEligibleCompletedGrades(11)).toEqual([
      "Middle School",
      "Freshman (9)",
      "Freshman Summer",
      "Sophomore (10)",
      "Sophomore Summer",
    ]);
  });

  it("includes all periods before senior year but not senior", () => {
    expect(getEligibleCompletedGrades(12)).toEqual([
      "Middle School",
      "Freshman (9)",
      "Freshman Summer",
      "Sophomore (10)",
      "Sophomore Summer",
      "Junior (11)",
      "Junior Summer",
    ]);
  });

  it("returns only values that exist in GRADE_COMPLETED_OPTIONS", () => {
    const valid = new Set<string>(GRADE_COMPLETED_OPTIONS);
    for (const year of [9, 10, 11, 12]) {
      for (const grade of getEligibleCompletedGrades(year)) {
        expect(valid.has(grade)).toBe(true);
      }
    }
  });

  it("defaults to the immediately preceding academic year", () => {
    expect(getDefaultCompletedGrade(9)).toBe("Middle School");
    expect(getDefaultCompletedGrade(10)).toBe("Freshman (9)");
    expect(getDefaultCompletedGrade(11)).toBe("Sophomore (10)");
    expect(getDefaultCompletedGrade(12)).toBe("Junior (11)");
  });
});

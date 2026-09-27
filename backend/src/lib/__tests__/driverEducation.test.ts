import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Prisma is replaced with two plain rows: `hasDriverEducationCourse` only ever
// reads `plannedCourse.findMany` and `completedCourse.findMany`.
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  planned: [] as Row[],
  completed: [] as Row[],
}));

vi.mock("../prisma.js", () => ({
  prisma: {
    plannedCourse: { findMany: () => Promise.resolve(db.planned) },
    completedCourse: { findMany: () => Promise.resolve(db.completed) },
    requirementResolution: { findMany: () => Promise.resolve([]) },
  },
}));

import { hasDriverEducationCourse } from "../driverEducation.js";

function driverEd(fulfillsRequirements: string[]): Row {
  return { fulfillsRequirements };
}

beforeEach(() => {
  db.planned = [];
  db.completed = [];
});

describe("hasDriverEducationCourse", () => {
  it("is true when Driver Education is planned", async () => {
    db.planned.push({ course: driverEd(["Driver Education"]) });
    expect(await hasDriverEducationCourse(1)).toBe(true);
  });

  it("is true when Driver Education was completed in high school", async () => {
    db.completed.push({ gradeCompleted: "Freshman (9)", course: driverEd(["Driver Education"]) });
    expect(await hasDriverEducationCourse(1)).toBe(true);
  });

  it("is false when Driver Education was only completed in middle school", async () => {
    // Middle-school completions never count toward graduation, so they must
    // not block the "completed outside school" resolution.
    db.completed.push({ gradeCompleted: "Middle School", course: driverEd(["Driver Education"]) });
    expect(await hasDriverEducationCourse(1)).toBe(false);
  });

  it("is false when Driver Education appears nowhere", async () => {
    db.completed.push({ gradeCompleted: "Freshman (9)", course: driverEd(["English"]) });
    expect(await hasDriverEducationCourse(1)).toBe(false);
  });
});

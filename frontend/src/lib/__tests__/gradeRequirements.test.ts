import { describe, it, expect } from "vitest";
import {
  computeEffectivePeStatus,
  computePeYearRows,
  PE_YEAR_LABELS,
  type PeSemesterStatus,
} from "@/lib/gradeRequirements";

function makeBreakdown(metSemesters: number[], titles: Record<number, string> = {}): Array<{
  semester: number;
  met: boolean;
  courseTitle: string | null;
  requiredLabel: string;
}> {
  return Array.from({ length: 8 }, (_, i) => ({
    semester: i + 1,
    met: metSemesters.includes(i + 1),
    courseTitle: titles[i + 1] ?? null,
    requiredLabel: `Semester ${i + 1} label`,
  }));
}

describe("computeEffectivePeStatus", () => {
  it("returns the semesters unchanged when there are no waivers", () => {
    const semesters: PeSemesterStatus[] = [
      { semester: 1, isMet: false, courseTitle: null, requiredLabel: "PE" },
      { semester: 2, isMet: true, courseTitle: "PE", requiredLabel: "PE" },
    ];
    expect(computeEffectivePeStatus(semesters, [])).toEqual(semesters);
  });

  it("marks all semesters met for a full waiver", () => {
    const semesters: PeSemesterStatus[] = [
      { semester: 1, isMet: false, courseTitle: null, requiredLabel: "PE" },
      { semester: 2, isMet: false, courseTitle: null, requiredLabel: "PE" },
    ];
    const result = computeEffectivePeStatus(semesters, [
      { type: "academic" },
    ]);
    expect(result.every((s) => s.isMet)).toBe(true);
  });

  it("marks only semester 1 met for a marching band waiver", () => {
    const semesters: PeSemesterStatus[] = [
      { semester: 1, isMet: false, courseTitle: null, requiredLabel: "PE" },
      { semester: 2, isMet: false, courseTitle: null, requiredLabel: "PE" },
    ];
    const result = computeEffectivePeStatus(semesters, [
      { type: "marching-band" },
    ]);
    expect(result[0].isMet).toBe(true);
    expect(result[1].isMet).toBe(false);
  });
});

describe("computePeYearRows", () => {
  it("returns one row per year with correct labels", () => {
    const rows = computePeYearRows(makeBreakdown([]), []);
    expect(rows.map((r) => r.year)).toEqual([9, 10, 11, 12]);
    expect(rows.map((r) => PE_YEAR_LABELS[r.year])).toEqual([
      "Freshman",
      "Sophomore",
      "Junior",
      "Senior",
    ]);
    expect(rows.every((r) => r.semester1.met === false && r.semester2.met === false)).toBe(true);
    expect(rows.every((r) => r.semester1.reason === null && r.semester2.reason === null)).toBe(true);
  });

  it("marks semesters as course-satisfied with course titles", () => {
    const rows = computePeYearRows(
      makeBreakdown([1, 2], { 1: "Foundational Fitness", 2: "PE" }),
      []
    );
    const freshman = rows[0];
    expect(freshman.semester1.met).toBe(true);
    expect(freshman.semester1.reason).toBe("course");
    expect(freshman.semester1.courseTitle).toBe("Foundational Fitness");
    expect(freshman.semester2.reason).toBe("course");
    expect(freshman.semester2.courseTitle).toBe("PE");
  });

  it("labels semesters met via waiver without a course title", () => {
    const rows = computePeYearRows(makeBreakdown([5, 6]), [
      { type: "pe_waiver", metadata: { variant: "academic", year: 11 } },
    ]);
    const junior = rows.find((r) => r.year === 11)!;
    expect(junior.semester1.met).toBe(true);
    expect(junior.semester1.reason).toBe("waiver");
    expect(junior.semester1.courseTitle).toBeNull();
    expect(junior.semester2.reason).toBe("waiver");
    expect(junior.semester2.courseTitle).toBeNull();
  });

  it("ignores non-PE resolutions and waivers without a year", () => {
    const rows = computePeYearRows(makeBreakdown([1, 2]), [
      { type: "pe_waiver", metadata: { variant: "driver_ed_external" } },
      { type: "middle_school", metadata: { year: 11 } },
      { type: "pe_waiver", metadata: { variant: "academic", year: 9 } },
    ]);
    const freshman = rows[0];
    expect(freshman.semester1.met).toBe(true);
    expect(freshman.semester1.reason).toBe("waiver");
    expect(freshman.semester1.courseTitle).toBeNull();
    expect(freshman.semester2.reason).toBe("waiver");
    expect(rows.filter((r) => r.year !== 9).every((r) => !r.semester1.met)).toBe(true);
  });
});

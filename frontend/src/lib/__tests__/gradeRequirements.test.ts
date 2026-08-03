import { describe, it, expect } from "vitest";
import {
  computeEffectivePeStatus,
  computePePerSemester,
  computePeYearRows,
  PE_YEAR_LABELS,
  type PeSemesterStatus,
} from "@/lib/gradeRequirements";
import type { PlannedCourse, PlannerCourseDetails } from "@/lib/planner";

function makeCourse(overrides: Partial<PlannerCourseDetails> = {}): PlannerCourseDetails {
  return {
    id: 1,
    title: "Physical Education",
    normalizedTitle: "physical education",
    duration: 1,
    slotsPerSemester: 1,
    creditType: "regular",
    credits: 1,
    division: "Physical Education",
    department: "Physical Education",
    description: null,
    fulfillsRequirements: ["Physical Education"],
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

function makePlanned(course: PlannerCourseDetails, semester: number, slot = 1): PlannedCourse {
  return {
    id: course.id,
    plannerId: 0,
    courseId: course.id,
    plannerOptionId: null,
    semester,
    slot,
    slotSpan: course.slotsPerSemester,
    course,
    isEarlyBird: false,
  };
}

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

  it("honors pe_waiver resolutions that carry the variant in metadata", () => {
    const semesters: PeSemesterStatus[] = [
      { semester: 1, isMet: false, courseTitle: null, requiredLabel: "PE" },
      { semester: 2, isMet: false, courseTitle: null, requiredLabel: "PE" },
    ];
    const full = computeEffectivePeStatus(semesters, [
      { type: "pe_waiver", metadata: { variant: "academic", year: 11 } },
    ]);
    expect(full.every((s) => s.isMet)).toBe(true);

    const marching = computeEffectivePeStatus(semesters, [
      { type: "pe_waiver", metadata: { variant: "marching-band", year: 9 } },
    ]);
    expect(marching[0].isMet).toBe(true);
    expect(marching[1].isMet).toBe(false);
  });
});

describe("computePePerSemester", () => {
  it("marks both semesters met when PE courses fill both semesters", () => {
    const result = computePePerSemester(
      [
        makePlanned(makeCourse({ title: "Choice P.E." }), 1),
        makePlanned(makeCourse({ title: "Choice P.E." }), 2),
      ],
      10
    );
    expect(result).toHaveLength(2);
    expect(result[0].isMet).toBe(true);
    expect(result[1].isMet).toBe(true);
  });

  it("counts a full-year PE course toward both semesters once", () => {
    const fullYear = makeCourse({ title: "Alternative Physical Education", duration: 2, credits: 2 });
    const result = computePePerSemester(
      [
        makePlanned(fullYear, 1),
        makePlanned(fullYear, 2),
      ],
      11
    );
    expect(result[0].isMet).toBe(true);
    expect(result[1].isMet).toBe(true);
  });

  it("counts Health and Applied Health courses by division as PE semesters", () => {
    const health = makeCourse({ title: "Health Education", fulfillsRequirements: ["Health"] });
    const appliedHealth = makeCourse({ title: "Applied Health", fulfillsRequirements: ["Health"] });
    const result = computePePerSemester(
      [makePlanned(health, 1), makePlanned(appliedHealth, 2)],
      10
    );
    expect(result[0].isMet).toBe(true);
    expect(result[1].isMet).toBe(true);
  });

  it("requires Freshman Foundational Fitness in semester 1 for grade 9", () => {
    const choicePe = makeCourse({ title: "Choice P.E." });
    const foundationalFitness = makeCourse({ title: "Freshman Foundational Fitness Choice P.E." });
    const wrongOrder = computePePerSemester(
      [makePlanned(choicePe, 1), makePlanned(foundationalFitness, 2)],
      9
    );
    expect(wrongOrder[0].isMet).toBe(false);
    expect(wrongOrder[1].isMet).toBe(true);

    const correctOrder = computePePerSemester(
      [makePlanned(foundationalFitness, 1), makePlanned(choicePe, 2)],
      9
    );
    expect(correctOrder[0].isMet).toBe(true);
    expect(correctOrder[1].isMet).toBe(true);
  });

  it("does not mark a year met with only one PE semester", () => {
    const result = computePePerSemester(
      [makePlanned(makeCourse({ title: "Choice P.E." }), 1)],
      10
    );
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

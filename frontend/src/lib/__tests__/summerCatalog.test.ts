import { describe, it, expect } from "vitest";
import type { SummerCourse } from "../summerCourse";
import {
  formatSummerOpenTo,
  formatSummerSessionsRaw,
  getSummerCost,
  getSummerDurationLabel,
  getSummerPassFail,
  getSummerScheduleNotes,
  normalizeSummerCourseForCatalog,
  normalizeSummerTitle,
} from "../summerCatalog";

function makeCourse(overrides: Partial<SummerCourse> = {}): SummerCourse {
  return {
    id: 1,
    key: "careers-in-business",
    title: "CAREERS IN BUSINESS",
    courseCode: "CAR53S",
    description: "A two-week course about business careers.",
    creditStatus: "credit",
    credits: 0.5,
    duration: "one_session",
    prerequisites: [],
    corequisites: [],
    fulfillsRequirements: [],
    isSummerOnly: true,
    division: "Career Exploration",
    instructionalCreditType: null,
    attributes: [],
    notes: [],
    sourcePage: 9,
    sourceReference: null,
    regularCourseId: null,
    regularCourse: null,
    sessions: ["Session 1"],
    gradeLevels: [10, 11, 12],
    ...overrides,
  };
}

describe("normalizeSummerTitle", () => {
  it("title-cases all-caps titles", () => {
    expect(normalizeSummerTitle("CAREERS IN BUSINESS")).toBe("Careers in Business");
    expect(normalizeSummerTitle("INTRODUCTION TO BIOTECHNOLOGY")).toBe("Introduction to Biotechnology");
    expect(normalizeSummerTitle("READING AND WRITING FOR STEVENSON")).toBe("Reading and Writing for Stevenson");
  });

  it("preserves acronyms and codes", () => {
    expect(normalizeSummerTitle("ACT PREPARATORY COURSE")).toBe("ACT Preparatory Course");
    expect(normalizeSummerTitle("ELD SKILLS IN FOCUS: ORACY AND LITERACY")).toBe(
      "ELD Skills in Focus: Oracy and Literacy"
    );
    expect(normalizeSummerTitle("ALGEBRA 2 AB/BC")).toBe("Algebra 2 AB/BC");
    expect(normalizeSummerTitle("U.S. HISTORY")).toBe("U.S. History");
    expect(normalizeSummerTitle("BUSINESS APPLICATIONS AND TECHNOLOGY 1")).toBe(
      "Business Applications and Technology 1"
    );
  });

  it("passes mixed-case titles through unchanged", () => {
    expect(normalizeSummerTitle("Careers in Business")).toBe("Careers in Business");
  });

  it("handles empty input", () => {
    expect(normalizeSummerTitle("")).toBe("");
    expect(normalizeSummerTitle(null)).toBe("");
  });
});

describe("normalizeSummerCourseForCatalog", () => {
  it("applies the normalized title and keeps only the division + credit marking on cards", () => {
    const course = normalizeSummerCourseForCatalog(makeCourse());
    expect(course.title).toBe("Careers in Business");
    expect(course.catalogMeta).toEqual([]);
    expect(course.attributes).toEqual([]);
    expect(course.department?.name).toBe("Career Exploration");
    expect(course.normalizedTitle).toBe("careers-in-business");
    expect(course.options?.[0]?.creditType).toBe("Credit");
  });

  it("keeps the stable kebab-case key as the slug", () => {
    const course = normalizeSummerCourseForCatalog(makeCourse({ key: "algebra-2-ab-bc" }));
    expect(course.normalizedTitle).toBe("algebra-2-ab-bc");
  });
});

describe("summer note parsing", () => {
  it("extracts the printed cost line", () => {
    const course = makeCourse({
      notes: ["Cost: $425/semester + $400 behind the wheel driving + $20 fee."],
    });
    expect(getSummerCost(course)).toContain("$425");
  });

  it("returns null when no cost is printed", () => {
    expect(getSummerCost(makeCourse())).toBeNull();
  });

  it("extracts schedule lines with dates or times", () => {
    const course = makeCourse({
      notes: [
        "M-F 8:45-11:45 a.m.",
        "Students who register for multiple sessions may attend more than one.",
        "June 8 - June 12",
      ],
    });
    expect(getSummerScheduleNotes(course)).toEqual(["M-F 8:45-11:45 a.m.", "June 8 - June 12"]);
  });

  it("detects Pass/Fail from both attributes and notes", () => {
    expect(getSummerPassFail(makeCourse({ attributes: ["Pass/Fail"] }))).toBe(true);
    expect(getSummerPassFail(makeCourse({ notes: ["This course is Pass/Fail."] }))).toBe(true);
    expect(getSummerPassFail(makeCourse())).toBe(false);
  });

  it("derives the duration from printed notes before falling back", () => {
    const twoWeek = makeCourse({ notes: ["A two-week course for interested students."] });
    expect(getSummerDurationLabel(twoWeek)).toBe("Two-week");
    expect(getSummerDurationLabel(makeCourse({ duration: "full_summer" }))).toBe("Full Summer");
    expect(getSummerDurationLabel(makeCourse())).toBe("One Session");
  });

  it("formats open-to grades and sessions compactly", () => {
    expect(formatSummerOpenTo(makeCourse())).toBe("10-11-12");
    expect(formatSummerSessionsRaw(makeCourse())).toBe("Session 1");
    expect(formatSummerSessionsRaw(makeCourse({ sessions: ["Session 1", "Session 2"] }))).toBe(
      "Session 1 / Session 2"
    );
  });
});
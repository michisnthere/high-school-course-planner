import { describe, expect, it } from "vitest";
import type { CompletedCourse } from "@/lib/completedCourses";
import {
  FILTER_ORDER,
  filterCompletedCoursesByPeriod,
  filterSummerCoursesByQuery,
  getAcademicPeriodLabel,
  groupCompletedCoursesByPeriod,
  isSummerCompletedCourse,
  REGULAR_GRADE_COMPLETED_OPTIONS,
  SUMMER_GRADE_COMPLETED_OPTIONS,
  defaultGradeForContext,
  gradeOptionsForContext,
  isGradeValidForContext,
} from "@/lib/completedCoursePeriods";

function course(id: number, title: string, gradeCompleted: CompletedCourse["gradeCompleted"]): CompletedCourse {
  return {
    id,
    userId: -1,
    courseId: id,
    summerCourseId: null,
    gradeCompleted,
    credits: 1,
    summerCourse: null,
    course: {
      id,
      title,
      normalizedTitle: null,
      duration: 1,
      slotsPerSemester: 1,
      creditType: null,
      credits: 1,
      division: null,
      department: null,
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
    },
  };
}

describe("completed course academic periods", () => {
  it("maps existing stored values to display periods", () => {
    expect(getAcademicPeriodLabel("Middle School")).toBe("Middle School");
    expect(getAcademicPeriodLabel("Middle School Summer")).toBe("Middle School Summer (Before Middle School)");
    expect(getAcademicPeriodLabel("Freshman (9)")).toBe("Freshman");
    expect(getAcademicPeriodLabel("Freshman Summer")).toBe("Freshman Summer (Middle School → 9th Grade)");
    expect(getAcademicPeriodLabel("Sophomore (10)")).toBe("Sophomore");
    expect(getAcademicPeriodLabel("Sophomore Summer")).toBe("Sophomore Summer (9th → 10th Grade)");
    expect(getAcademicPeriodLabel("Junior (11)")).toBe("Junior");
    expect(getAcademicPeriodLabel("Junior Summer")).toBe("Junior Summer (10th → 11th Grade)");
    expect(getAcademicPeriodLabel("Senior (12)")).toBe("Senior");
    expect(getAcademicPeriodLabel("Senior Summer")).toBe("Senior Summer (11th → 12th Grade)");
    expect(getAcademicPeriodLabel("Summer School")).toBe("Summer School");
  });

  it("adds transition parentheticals only to Summer display labels, never to stored values", () => {
    // Stored values stay exactly as they were persisted; only the rendered
    // label carries the transition description.
    expect(SUMMER_GRADE_COMPLETED_OPTIONS).toEqual([
      "Middle School Summer",
      "Freshman Summer",
      "Sophomore Summer",
      "Junior Summer",
      "Senior Summer",
    ]);
    // Every Summer selector option renders a transitioned label.
    for (const grade of SUMMER_GRADE_COMPLETED_OPTIONS) {
      expect(getAcademicPeriodLabel(grade)).not.toBe(grade);
    }
    // The legacy generic value keeps its plain label (program context).
    expect(getAcademicPeriodLabel("Summer School")).toBe("Summer School");
    // Regular-year options never gain a parenthetical.
    expect(getAcademicPeriodLabel("Freshman (9)")).toBe("Freshman");
    expect(getAcademicPeriodLabel("Sophomore (10)")).toBe("Sophomore");
    expect(getAcademicPeriodLabel("Junior (11)")).toBe("Junior");
    expect(getAcademicPeriodLabel("Senior (12)")).toBe("Senior");
  });

  it("offers Summer School as a grouping filter alongside the regular grade-level filters", () => {
    // Summer School is a filter category, so it appears as a filter button.
    expect(FILTER_ORDER).toContain("Summer School");
    // Regular grade levels remain available as filters.
    expect(FILTER_ORDER).toContain("All");
    expect(FILTER_ORDER).toContain("Middle School");
    expect(FILTER_ORDER).toContain("Freshman");
    expect(FILTER_ORDER).toContain("Sophomore");
    expect(FILTER_ORDER).toContain("Junior");
    expect(FILTER_ORDER).toContain("Senior");
    // Per-year summer values are NOT separate filters (they collapse under
    // the Summer School category).
    expect(FILTER_ORDER).not.toContain("Middle School Summer");
    expect(FILTER_ORDER).not.toContain("Freshman Summer");
    expect(FILTER_ORDER).not.toContain("Senior Summer");
  });

  it("groups completed courses by academic period", () => {
    const grouped = groupCompletedCoursesByPeriod([
      course(1, "English I", "Freshman (9)"),
      course(2, "Geometry", "Freshman (9)"),
      course(3, "Biology", "Sophomore (10)"),
      course(4, "Algebra I", "Middle School"),
    ]);

    expect(grouped.find((group) => group.label === "Middle School")?.courses.map((item) => item.course.title)).toEqual(["Algebra I"]);
    expect(grouped.find((group) => group.label === "Freshman")?.courses.map((item) => item.course.title)).toEqual(["English I", "Geometry"]);
    expect(grouped.find((group) => group.label === "Sophomore")?.courses.map((item) => item.course.title)).toEqual(["Biology"]);
  });

  it("filters without changing loaded course data", () => {
    const courses = [
      course(1, "English I", "Freshman (9)"),
      course(2, "Geometry", "Freshman (9)"),
      course(3, "Chemistry", "Junior (11)"),
    ];

     expect(filterCompletedCoursesByPeriod(courses, "All")).toHaveLength(3);
     expect(filterCompletedCoursesByPeriod(courses, "Freshman").map((item) => item.course.title)).toEqual(["English I", "Geometry"]);
     expect(filterCompletedCoursesByPeriod(courses, "Junior").map((item) => item.course.title)).toEqual(["Chemistry"]);
   });
 });

describe("completed course summer consolidation", () => {
  it("consolidates all per-year summer courses into a single Summer School group", () => {
    const grouped = groupCompletedCoursesByPeriod([
      course(1, "English I", "Freshman (9)"),
      course(2, "Algebra I", "Middle School"),
      course(3, "Summer Math", "Middle School Summer"),
      course(4, "Summer Physics", "Freshman Summer"),
      course(5, "Summer Chem", "Sophomore Summer"),
      course(6, "Summer Calc", "Junior Summer"),
      course(7, "Summer Stats", "Senior Summer"),
    ]);

    const summer = grouped.find((g) => g.label === "Summer School");
    expect(summer).toBeDefined();
    expect(summer?.isSummer).toBe(true);
    expect(summer?.courses.map((i) => i.course.title)).toEqual([
      "Summer Math",
      "Summer Physics",
      "Summer Chem",
      "Summer Calc",
      "Summer Stats",
    ]);
    expect(grouped.find((g) => g.label === "Freshman")?.courses).toHaveLength(1);
    expect(grouped.find((g) => g.label === "Sophomore")?.courses).toHaveLength(0);
  });

  it("does not mix summer courses into regular year groups", () => {
    const grouped = groupCompletedCoursesByPeriod([
      course(1, "English I", "Freshman (9)"),
      course(2, "Freshman Summer Course", "Freshman Summer"),
    ]);

    expect(grouped.find((g) => g.label === "Freshman")?.courses.map((c) => c.course.title)).toEqual(["English I"]);
    expect(grouped.find((g) => g.label === "Summer School")?.courses.map((c) => c.course.title)).toEqual(["Freshman Summer Course"]);
  });

  it("subdivides the Summer School group into year-based sections in progression order", () => {
    const grouped = groupCompletedCoursesByPeriod([
      course(1, "Senior Summer Course", "Senior Summer"),
      course(2, "Freshman Summer Course", "Freshman Summer"),
      course(3, "Middle School Summer Course", "Middle School Summer"),
      course(4, "Junior Summer Course", "Junior Summer"),
    ]);

    const summer = grouped.find((g) => g.label === "Summer School");
    expect(summer?.summerSubSections?.map((s) => s.yearLabel)).toEqual([
      "Middle School Summer",
      "Freshman Summer",
      "Junior Summer",
      "Senior Summer",
    ]);
    expect(summer?.summerSubSections?.find((s) => s.yearLabel === "Senior Summer")?.courses.map((c) => c.course.title)).toEqual(["Senior Summer Course"]);
  });

  it("omits empty summer subsections", () => {
    const grouped = groupCompletedCoursesByPeriod([
      course(1, "Freshman Summer Course", "Freshman Summer"),
    ]);

    const summer = grouped.find((g) => g.label === "Summer School");
    expect(summer?.summerSubSections?.map((s) => s.yearLabel)).toEqual(["Freshman Summer"]);
  });

  it("isSummerCompletedCourse identifies each summer grade", () => {
    expect(isSummerCompletedCourse(course(1, "A", "Middle School Summer"))).toBe(true);
    expect(isSummerCompletedCourse(course(2, "B", "Freshman Summer"))).toBe(true);
    expect(isSummerCompletedCourse(course(3, "C", "Sophomore Summer"))).toBe(true);
    expect(isSummerCompletedCourse(course(4, "D", "Junior Summer"))).toBe(true);
    expect(isSummerCompletedCourse(course(5, "E", "Senior Summer"))).toBe(true);
    expect(isSummerCompletedCourse(course(6, "F", "Summer School"))).toBe(true);
    expect(isSummerCompletedCourse(course(7, "G", "Freshman (9)"))).toBe(false);
    expect(isSummerCompletedCourse(course(8, "H", "Middle School"))).toBe(false);
  });

  it("still surfaces legacy Summer School records under the All filter", () => {
    const courses = [
      course(1, "English I", "Freshman (9)"),
      course(2, "PE", "Summer School"),
      course(3, "Summer Physics", "Freshman Summer"),
    ];

    // "All" keeps every record, including legacy + per-year summer values.
    expect(filterCompletedCoursesByPeriod(courses, "All")).toHaveLength(3);
    // A regular-grade filter never pulls in summer records.
    expect(filterCompletedCoursesByPeriod(courses, "Freshman").map((c) => c.course.title)).toEqual(["English I"]);
  });

  it("never treats a regular filter as a Summer School filter", () => {
    const courses = [
      course(1, "Summer Course", "Middle School Summer"),
      course(2, "Algebra I", "Middle School"),
    ];

    expect(filterCompletedCoursesByPeriod(courses, "All")).toHaveLength(2);
    expect(filterCompletedCoursesByPeriod(courses, "Middle School").map((c) => c.course.title)).toEqual(["Algebra I"]);
  });

  it("Summer School filter returns every summer-period course across all years", () => {
    const courses = [
      course(1, "MS Summer Math", "Middle School Summer"),
      course(2, "Freshman Summer Physics", "Freshman Summer"),
      course(3, "Sophomore Summer Chem", "Sophomore Summer"),
      course(4, "Junior Summer Calc", "Junior Summer"),
      course(5, "Senior Summer Stats", "Senior Summer"),
      course(6, "Legacy Summer PE", "Summer School"),
      course(7, "English I", "Freshman (9)"),
      course(8, "Algebra I", "Middle School"),
    ];

    const summer = filterCompletedCoursesByPeriod(courses, "Summer School");
    expect(summer.map((c) => c.course.title)).toEqual([
      "MS Summer Math",
      "Freshman Summer Physics",
      "Sophomore Summer Chem",
      "Junior Summer Calc",
      "Senior Summer Stats",
      "Legacy Summer PE",
    ]);
    expect(summer.every((c) => isSummerCompletedCourse(c))).toBe(true);
  });

  it("Summer School filter is a category that groups all summer periods under one section", () => {
    const courses = [
      course(1, "Middle School Summer Course", "Middle School Summer"),
      course(2, "Senior Summer Course", "Senior Summer"),
    ];

    const filtered = filterCompletedCoursesByPeriod(courses, "Summer School");
    const grouped = groupCompletedCoursesByPeriod(filtered);
    const summer = grouped.find((g) => g.label === "Summer School");
    expect(summer?.courses.map((c) => c.course.title)).toEqual([
      "Middle School Summer Course",
      "Senior Summer Course",
    ]);
    expect(summer?.summerSubSections?.map((s) => s.yearLabel)).toEqual([
      "Middle School Summer",
      "Senior Summer",
    ]);
    // No regular grade group is produced by the Summer School category filter.
    expect(grouped.filter((g) => !g.isSummer).every((g) => g.courses.length === 0)).toBe(true);
  });
});

describe("context-aware grade options", () => {
  it("regular options contain only regular-year periods, never Summer-specific ones", () => {
    expect(REGULAR_GRADE_COMPLETED_OPTIONS).toContain("Middle School");
    expect(REGULAR_GRADE_COMPLETED_OPTIONS).toContain("Freshman (9)");
    expect(REGULAR_GRADE_COMPLETED_OPTIONS).toContain("Sophomore (10)");
    expect(REGULAR_GRADE_COMPLETED_OPTIONS).toContain("Junior (11)");
    expect(REGULAR_GRADE_COMPLETED_OPTIONS).toContain("Senior (12)");
    for (const summer of SUMMER_GRADE_COMPLETED_OPTIONS) {
      expect(REGULAR_GRADE_COMPLETED_OPTIONS).not.toContain(summer);
    }
  });

  it("summer options contain only Summer-specific periods, never regular ones or the generic context", () => {
    expect(SUMMER_GRADE_COMPLETED_OPTIONS).toContain("Middle School Summer");
    expect(SUMMER_GRADE_COMPLETED_OPTIONS).toContain("Freshman Summer");
    expect(SUMMER_GRADE_COMPLETED_OPTIONS).toContain("Sophomore Summer");
    expect(SUMMER_GRADE_COMPLETED_OPTIONS).toContain("Junior Summer");
    expect(SUMMER_GRADE_COMPLETED_OPTIONS).toContain("Senior Summer");
    expect(SUMMER_GRADE_COMPLETED_OPTIONS).not.toContain("Summer School");
    for (const regular of REGULAR_GRADE_COMPLETED_OPTIONS) {
      expect(SUMMER_GRADE_COMPLETED_OPTIONS).not.toContain(regular);
    }
  });

  it("switching course context swaps the entire option set (never a mix)", () => {
    expect(gradeOptionsForContext(false)).toEqual(REGULAR_GRADE_COMPLETED_OPTIONS);
    expect(gradeOptionsForContext(true)).toEqual(SUMMER_GRADE_COMPLETED_OPTIONS);
    expect(gradeOptionsForContext(true).some((g) => REGULAR_GRADE_COMPLETED_OPTIONS.includes(g))).toBe(false);
    expect(gradeOptionsForContext(false).some((g) => SUMMER_GRADE_COMPLETED_OPTIONS.includes(g))).toBe(false);
  });

  it("defaultGradeForContext preserves a valid grade and falls back to the generic option", () => {
    expect(defaultGradeForContext(false, "Freshman (9)")).toBe("Freshman (9)");
    expect(defaultGradeForContext(false, "Freshman Summer")).toBe("Middle School");
    expect(defaultGradeForContext(true, "Sophomore Summer")).toBe("Sophomore Summer");
    expect(defaultGradeForContext(true, "Middle School Summer")).toBe("Middle School Summer");
    expect(defaultGradeForContext(true, "Senior (12)")).toBe("Middle School Summer");
    expect(defaultGradeForContext(true, "Summer School")).toBe("Summer School");
    expect(defaultGradeForContext(true)).toBe("Middle School Summer");
    expect(defaultGradeForContext(false)).toBe("Middle School");
  });

  it("isGradeValidForContext rejects mixed values in both directions", () => {
    expect(isGradeValidForContext("Freshman (9)", false)).toBe(true);
    expect(isGradeValidForContext("Freshman Summer", false)).toBe(false);
    expect(isGradeValidForContext("Freshman Summer", true)).toBe(true);
    expect(isGradeValidForContext("Freshman (9)", true)).toBe(false);
  });
});

describe("Summer School course search", () => {
  const summerCourses = [
    { id: 1, title: "Careers in Business" },
    { id: 2, title: "Algebra 2 AB/BC" },
    { id: 3, title: "Health Lab" },
  ];

  it("finds a course by a partial title word", () => {
    expect(filterSummerCoursesByQuery(summerCourses, "careers").map((c) => c.title)).toEqual(["Careers in Business"]);
  });

  it("is case-insensitive", () => {
    expect(filterSummerCoursesByQuery(summerCourses, "HEALTH").map((c) => c.title)).toEqual(["Health Lab"]);
    expect(filterSummerCoursesByQuery(summerCourses, "CaReErS").map((c) => c.title)).toEqual(["Careers in Business"]);
  });

  it("matches normalized titles so spacing/punctuation does not block results", () => {
    expect(filterSummerCoursesByQuery(summerCourses, "careers in business").map((c) => c.title)).toEqual(["Careers in Business"]);
    expect(filterSummerCoursesByQuery(summerCourses, "algebra 2 ab").map((c) => c.title)).toEqual(["Algebra 2 AB/BC"]);
  });

  it("clearing the search restores every course", () => {
    expect(filterSummerCoursesByQuery(summerCourses, "health")).toHaveLength(1);
    expect(filterSummerCoursesByQuery(summerCourses, "")).toEqual(summerCourses);
    expect(filterSummerCoursesByQuery(summerCourses, "   ")).toEqual(summerCourses);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterSummerCoursesByQuery(summerCourses, "zzz")).toEqual([]);
  });
});

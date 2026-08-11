import { describe, expect, it } from "vitest";
import type { CompletedCourse } from "@/lib/completedCourses";
import {
  filterCompletedCoursesByPeriod,
  getAcademicPeriodLabel,
  groupCompletedCoursesByPeriod,
  isSummerCompletedCourse,
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
    expect(getAcademicPeriodLabel("Freshman (9)")).toBe("Freshman");
    expect(getAcademicPeriodLabel("Freshman Summer")).toBe("Freshman Summer");
    expect(getAcademicPeriodLabel("Sophomore (10)")).toBe("Sophomore");
    expect(getAcademicPeriodLabel("Sophomore Summer")).toBe("Sophomore Summer");
    expect(getAcademicPeriodLabel("Junior (11)")).toBe("Junior");
    expect(getAcademicPeriodLabel("Junior Summer")).toBe("Junior Summer");
    expect(getAcademicPeriodLabel("Senior (12)")).toBe("Senior");
    expect(getAcademicPeriodLabel("Senior Summer")).toBe("Senior Summer");
    expect(getAcademicPeriodLabel("Summer School")).toBe("Summer School");
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
      course(3, "Summer Physics", "Freshman Summer"),
      course(4, "Summer Chem", "Sophomore Summer"),
      course(5, "Summer Calc", "Junior Summer"),
      course(6, "Summer Stats", "Senior Summer"),
    ]);

    const summer = grouped.find((g) => g.label === "Summer School");
    expect(summer).toBeDefined();
    expect(summer?.isSummer).toBe(true);
    expect(summer?.courses.map((i) => i.course.title)).toEqual([
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

  it("subdivides the Summer School group into year-based sections in order", () => {
    const grouped = groupCompletedCoursesByPeriod([
      course(1, "Senior Summer Course", "Senior Summer"),
      course(2, "Freshman Summer Course", "Freshman Summer"),
      course(3, "Junior Summer Course", "Junior Summer"),
    ]);

    const summer = grouped.find((g) => g.label === "Summer School");
    expect(summer?.summerSubSections?.map((s) => s.yearLabel)).toEqual([
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
    expect(isSummerCompletedCourse(course(1, "A", "Freshman Summer"))).toBe(true);
    expect(isSummerCompletedCourse(course(2, "B", "Sophomore Summer"))).toBe(true);
    expect(isSummerCompletedCourse(course(3, "C", "Junior Summer"))).toBe(true);
    expect(isSummerCompletedCourse(course(4, "D", "Senior Summer"))).toBe(true);
    expect(isSummerCompletedCourse(course(5, "E", "Summer School"))).toBe(true);
    expect(isSummerCompletedCourse(course(6, "F", "Freshman (9)"))).toBe(false);
    expect(isSummerCompletedCourse(course(7, "G", "Middle School"))).toBe(false);
  });

  it("filters Summer School to return only summer courses", () => {
    const courses = [
      course(1, "English I", "Freshman (9)"),
      course(2, "PE", "Summer School"),
      course(3, "Summer Physics", "Freshman Summer"),
    ];

    expect(filterCompletedCoursesByPeriod(courses, "Summer School").map((c) => c.course.title)).toEqual([
      "PE",
      "Summer Physics",
    ]);
    expect(filterCompletedCoursesByPeriod(courses, "All")).toHaveLength(3);
    expect(filterCompletedCoursesByPeriod(courses, "Freshman").map((c) => c.course.title)).toEqual(["English I"]);
  });
});

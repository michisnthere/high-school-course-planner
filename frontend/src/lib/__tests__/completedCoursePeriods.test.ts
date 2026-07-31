import { describe, expect, it } from "vitest";
import type { CompletedCourse } from "@/lib/completedCourses";
import {
  filterCompletedCoursesByPeriod,
  getAcademicPeriodLabel,
  groupCompletedCoursesByPeriod,
} from "@/lib/completedCoursePeriods";

function course(id: number, title: string, gradeCompleted: CompletedCourse["gradeCompleted"]): CompletedCourse {
  return {
    id,
    userId: -1,
    courseId: id,
    gradeCompleted,
    credits: 1,
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

import { describe, it, expect } from "vitest";
import type { Course } from "@/types/course";
import { getCoursesRequiringPrerequisite } from "@/lib/catalog";

function makeCourse(id: number, title: string, prerequisites: string[], courseCodes: string[] = []): Course {
  return {
    id,
    title,
    normalizedTitle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    duration: 1,
    slotsPerSemester: 1,
    attributes: [],
    fulfillsRequirements: [],
    options: [
      {
        name: "Regular",
        creditType: "College Prep",
        credits: 1,
        offerings:
          courseCodes.length > 0
            ? courseCodes.map((courseCode) => ({ courseCode, prerequisites }))
            : [{ courseCode: undefined, prerequisites }],
      },
    ],
  } as Course;
}

function titles(courses: Course[]): string[] {
  return courses.map((c) => c.title);
}

describe("getCoursesRequiringPrerequisite", () => {
  it("returns courses that list the current course as a title prerequisite", () => {
    const geometry = makeCourse(1, "Geometry", []);
    const algebra2 = makeCourse(2, "Algebra 2 Honors", ["Geometry"]);
    const precalc = makeCourse(3, "Precalculus", ["Geometry"]);
    const apPrecalc = makeCourse(4, "AP Precalculus", ["Geometry"]);

    const dependents = getCoursesRequiringPrerequisite(geometry, [geometry, algebra2, precalc, apPrecalc]);
    expect(titles(dependents).sort()).toEqual(["AP Precalculus", "Algebra 2 Honors", "Precalculus"]);
  });

  it("matches prerequisites stored as course codes", () => {
    const geometry = makeCourse(1, "Geometry", [], ["GEO101", "GEO102"]);
    const algebra2 = makeCourse(2, "Algebra 2 Honors", ["GEO101"]);
    const independent = makeCourse(3, "Art History", []);

    const dependents = getCoursesRequiringPrerequisite(geometry, [geometry, algebra2, independent]);
    expect(titles(dependents)).toEqual(["Algebra 2 Honors"]);
  });

  it("matches prerequisites that combine codes with OR/AND connectors", () => {
    const geometry = makeCourse(1, "Geometry", [], ["GEO101"]);
    const algebra1 = makeCourse(2, "Algebra 1", [], ["ALG101"]);
    const algebra2 = makeCourse(3, "Algebra 2 Honors", ["GEO101 or ALG101"]);

    const dependents = getCoursesRequiringPrerequisite(geometry, [geometry, algebra1, algebra2]);
    expect(titles(dependents)).toEqual(["Algebra 2 Honors"]);
  });

  it("deduplicates courses that match through multiple paths", () => {
    const geometry = makeCourse(1, "Geometry", [], ["GEO101"]);
    const algebra2 = makeCourse(2, "Algebra 2 Honors", ["Geometry and GEO101"]);

    const dependents = getCoursesRequiringPrerequisite(geometry, [geometry, algebra2]);
    expect(dependents).toHaveLength(1);
  });

  it("does not list the course itself as a dependent", () => {
    const course = makeCourse(1, "Geometry", ["Geometry"]);

    const dependents = getCoursesRequiringPrerequisite(course, [course]);
    expect(dependents).toEqual([]);
  });

  it("finds cross-department prerequisite relationships", () => {
    const geometry = makeCourse(1, "Geometry", []);
    const physics = makeCourse(2, "Physics", ["Geometry"], ["PHY101"]);

    const dependents = getCoursesRequiringPrerequisite(geometry, [geometry, physics]);
    expect(titles(dependents)).toEqual(["Physics"]);
  });

  it("returns an empty array when no courses depend on the course", () => {
    const course = makeCourse(1, "Independent Study", []);
    const other = makeCourse(2, "Some Course", ["Some Other Requirement"]);

    const dependents = getCoursesRequiringPrerequisite(course, [course, other]);
    expect(dependents).toEqual([]);
  });

  it("returns an empty array for an empty catalog", () => {
    const course = makeCourse(1, "Geometry", []);
    expect(getCoursesRequiringPrerequisite(course, [])).toEqual([]);
  });

  it("returns an empty array for a course required by many other courses", () => {
    const course = makeCourse(1, "Chemistry", []);
    const many = Array.from({ length: 50 }, (_, i) => makeCourse(i + 2, `Chem Dependent ${i}`, ["Chemistry"]));
    const dependents = getCoursesRequiringPrerequisite(course, [course, ...many]);
    expect(dependents).toHaveLength(50);
  });
});

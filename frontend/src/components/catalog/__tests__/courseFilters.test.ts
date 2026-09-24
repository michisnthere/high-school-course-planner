import { describe, it, expect } from "vitest";
import { getVisibleDepartments } from "@/components/catalog/CourseFilters";

describe("getVisibleDepartments", () => {
  it("returns all departments when no division is selected", () => {
    expect(getVisibleDepartments([], new Map(), ["Business Education", "CSET"])).toEqual([
      "Business Education",
      "CSET",
    ]);
  });

  it("hides the department whose name matches a single-department division", () => {
    const divisionDepartments = new Map([["Science", ["Science"]]]);
    expect(
      getVisibleDepartments(["Science"], divisionDepartments, ["Science", "CSET"])
    ).toEqual([]);
  });

  it("hides the same-named department but keeps sibling departments", () => {
    const divisionDepartments = new Map([
      [
        "Applied Arts",
        ["Applied Arts", "Business Education", "Family and Consumer Sciences"],
      ],
    ]);
    expect(
      getVisibleDepartments(["Applied Arts"], divisionDepartments, [
        "Applied Arts",
        "Business Education",
        "CSET",
      ])
    ).toEqual(["Business Education", "Family and Consumer Sciences"]);
  });

  it("hides CSET department for the CSET division but keeps Technology", () => {
    const divisionDepartments = new Map([["CSET", ["CSET", "Technology"]]]);
    expect(
      getVisibleDepartments(["CSET"], divisionDepartments, ["CSET", "Technology"])
    ).toEqual(["Technology"]);
  });

  it("matches department names case-insensitively ignoring surrounding whitespace", () => {
    const divisionDepartments = new Map([["Science", [" science "]]]);
    expect(getVisibleDepartments(["Science"], divisionDepartments, [" science "])).toEqual(
      []
    );
  });

  it("unions departments across multiple selected divisions and hides all same-named ones", () => {
    const divisionDepartments = new Map([
      ["Applied Arts", ["Applied Arts", "Business Education"]],
      ["CSET", ["CSET", "Technology"]],
    ]);
    expect(
      getVisibleDepartments(["Applied Arts", "CSET"], divisionDepartments, [])
    ).toEqual(["Business Education", "Technology"]);
  });

  it("keeps all unioned departments when no division name matches", () => {
    const divisionDepartments = new Map([["Social Studies", ["Social Studies"]]]);
    expect(
      getVisibleDepartments(["Social Studies"], divisionDepartments, ["Economics"])
    ).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import {
  courseFulfillsDriverEducation,
  hasDriverEducationCourse,
  isDriverEdExternalResolution,
  findDriverEdExternalResolution,
} from "@/lib/plannerWaivers";

describe("courseFulfillsDriverEducation", () => {
  it("returns true for a course listing Driver Education", () => {
    expect(courseFulfillsDriverEducation({ fulfillsRequirements: ["Driver Education"] })).toBe(true);
  });

  it("matches case-insensitively and with extra whitespace", () => {
    expect(courseFulfillsDriverEducation({ fulfillsRequirements: ["  driver   education "] })).toBe(true);
  });

  it("matches the driver education graduation requirement alias", () => {
    expect(
      courseFulfillsDriverEducation({ fulfillsRequirements: ["Driver Education Graduation Requirement"] })
    ).toBe(true);
  });

  it("returns false for unrelated requirements", () => {
    expect(courseFulfillsDriverEducation({ fulfillsRequirements: ["Physical Education", "Health"] })).toBe(false);
  });

  it("returns false when there are no requirements", () => {
    expect(courseFulfillsDriverEducation({ fulfillsRequirements: [] })).toBe(false);
    expect(courseFulfillsDriverEducation({ fulfillsRequirements: null })).toBe(false);
  });
});

describe("hasDriverEducationCourse", () => {
  it("detects Driver Education in planned courses", () => {
    const planned = [
      { course: { fulfillsRequirements: ["Mathematics"] } },
      { course: { fulfillsRequirements: ["Driver Education"] } },
    ];
    expect(hasDriverEducationCourse(planned, [])).toBe(true);
  });

  it("detects Driver Education in completed courses", () => {
    const completed = [{ course: { fulfillsRequirements: ["Driver Education"] } }];
    expect(hasDriverEducationCourse([], completed)).toBe(true);
  });

  it("returns false when Driver Education is nowhere", () => {
    const planned = [{ course: { fulfillsRequirements: ["English"] } }];
    const completed = [{ course: { fulfillsRequirements: ["Science"] } }];
    expect(hasDriverEducationCourse(planned, completed)).toBe(false);
  });
});

describe("isDriverEdExternalResolution", () => {
  it("returns true for a pe_waiver with the driver_ed_external variant", () => {
    expect(
      isDriverEdExternalResolution({ type: "pe_waiver", metadata: { variant: "driver_ed_external" } })
    ).toBe(true);
  });

  it("returns false for other waiver variants", () => {
    expect(isDriverEdExternalResolution({ type: "pe_waiver", metadata: { variant: "athletic" } })).toBe(false);
    expect(isDriverEdExternalResolution({ type: "pe_waiver", metadata: {} })).toBe(false);
  });

  it("returns false for other resolution types", () => {
    expect(isDriverEdExternalResolution({ type: "middle_school", metadata: {} })).toBe(false);
  });
});

describe("findDriverEdExternalResolution", () => {
  it("finds the external resolution when present", () => {
    const resolutions = [
      { id: 1, type: "pe_waiver", metadata: { variant: "athletic" } },
      { id: 2, type: "pe_waiver", metadata: { variant: "driver_ed_external" } },
    ];
    const found = findDriverEdExternalResolution(resolutions);
    expect(found?.id).toBe(2);
  });

  it("returns null when no external resolution exists", () => {
    const resolutions = [
      { id: 1, type: "pe_waiver", metadata: { variant: "academic" } },
      { id: 2, type: "middle_school", metadata: {} },
    ];
    expect(findDriverEdExternalResolution(resolutions)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(findDriverEdExternalResolution([])).toBeNull();
  });
});

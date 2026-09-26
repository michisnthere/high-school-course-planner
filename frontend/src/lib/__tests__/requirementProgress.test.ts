import { describe, expect, it } from "vitest";
import {
  computeRequirementDisplayStatus,
  computeRequirementSegments,
} from "@/lib/requirementProgress";

// The values below are the ones the graduation/planner analysis produces
// (`completedValue`, `plannedValue`) for a requirement with total 4.
describe("requirement progress segments", () => {
  it("Case 1 — fully completed renders only green", () => {
    const segments = computeRequirementSegments(4, 4, 0);
    expect(segments).toMatchObject({ green: 4, yellow: 0, gray: 0 });
    expect(segments.completedValue + segments.plannedValue + segments.remainingValue).toBe(4);
    expect(computeRequirementDisplayStatus(4, 4, 0)).toBe("satisfied");
  });

  it("Case 2 — half completed, half planned renders green + yellow and is tagged Planned", () => {
    const segments = computeRequirementSegments(4, 2, 2);
    expect(segments).toMatchObject({ green: 2, yellow: 2, gray: 0 });
    expect(computeRequirementDisplayStatus(4, 2, 2)).toBe("planned");
  });

  it("Case 3 — partially completed and partially planned leaves the rest gray", () => {
    const segments = computeRequirementSegments(4, 1, 1);
    expect(segments).toMatchObject({ green: 1, yellow: 1, gray: 2 });
    expect(segments.green + segments.yellow + segments.gray).toBe(4);
  });

  it("Case 4 — nothing completed or planned renders all gray", () => {
    const segments = computeRequirementSegments(4, 0, 0);
    expect(segments).toMatchObject({ green: 0, yellow: 0, gray: 4 });
    expect(computeRequirementDisplayStatus(4, 0, 0)).toBe("notStarted");
  });

  it("Case 5 — planned value is clamped to the remaining requirement", () => {
    const segments = computeRequirementSegments(4, 3, 3);
    expect(segments).toMatchObject({ green: 3, yellow: 1, gray: 0 });
    expect(segments.completedValue + segments.plannedValue).toBe(4);
    expect(computeRequirementDisplayStatus(4, 3, 3)).toBe("planned");
  });
});

describe("requirement progress normalization", () => {
  it("never lets a bar exceed the requirement total", () => {
    for (const [total, completed, planned] of [
      [4, 6, 0],
      [4, 0, 9],
      [4, 2, 9],
      [0, 2, 2],
      [-3, 2, 2],
    ] as const) {
      const segments = computeRequirementSegments(total, completed, planned);
      expect(segments.green).toBeGreaterThanOrEqual(0);
      expect(segments.yellow).toBeGreaterThanOrEqual(0);
      expect(segments.gray).toBeGreaterThanOrEqual(0);
      expect(segments.completedValue + segments.plannedValue + segments.remainingValue).toBe(
        Math.max(0, total)
      );
    }
  });

  it("tolerates missing or non-finite analysis values", () => {
    expect(computeRequirementSegments(undefined, null, Number.NaN)).toMatchObject({
      green: 0,
      yellow: 0,
      gray: 0,
      totalValue: 0,
    });
  });

  it("keeps the requirement's own unit — no conversion is applied", () => {
    // A 3.5-credit requirement (Physical Education) stays in credits.
    const segments = computeRequirementSegments(3.5, 1, 1);
    expect(segments).toMatchObject({ green: 1, yellow: 1, gray: 1.5 });
  });
});

describe("requirement display status", () => {
  it("is satisfied only when completed coursework covers the requirement", () => {
    expect(computeRequirementDisplayStatus(4, 4, 0)).toBe("satisfied");
    // Completed always wins over a planned contribution.
    expect(computeRequirementDisplayStatus(4, 4, 2)).toBe("satisfied");
    expect(computeRequirementDisplayStatus(0, 0, 0)).toBe("satisfied");
  });

  it("is not satisfied by the projected four-year plan alone", () => {
    expect(computeRequirementDisplayStatus(4, 0, 4)).toBe("planned");
    expect(computeRequirementDisplayStatus(4, 2, 2)).toBe("planned");
    expect(computeRequirementDisplayStatus(4, 0, 0)).not.toBe("satisfied");
    expect(computeRequirementDisplayStatus(4, 2, 0)).not.toBe("satisfied");
  });

  it("distinguishes partial from not started when nothing is planned", () => {
    expect(computeRequirementDisplayStatus(4, 1, 0)).toBe("partial");
    expect(computeRequirementDisplayStatus(4, 0, 0)).toBe("notStarted");
  });
});

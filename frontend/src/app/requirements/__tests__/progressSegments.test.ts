import { describe, expect, it } from "vitest";
import { computeRequirementSegments } from "../page";

describe("graduation requirement progress segments", () => {
  it("fully completed uses only green", () => {
    expect(computeRequirementSegments(4, 4, 0)).toMatchObject({
      completedValue: 4,
      plannedValue: 0,
      remainingValue: 0,
      green: 4,
      yellow: 0,
      gray: 0,
    });
  });

  it("half completed and half planned keeps the planned portion separate", () => {
    expect(computeRequirementSegments(4, 2, 2)).toMatchObject({
      completedValue: 2,
      plannedValue: 2,
      remainingValue: 0,
      green: 2,
      yellow: 2,
      gray: 0,
    });
  });

  it("partially completed and partially planned leaves unmet gray", () => {
    expect(computeRequirementSegments(4, 1, 1)).toMatchObject({
      completedValue: 1,
      plannedValue: 1,
      remainingValue: 2,
      green: 1,
      yellow: 1,
      gray: 2,
    });
  });

  it("nothing completed or planned renders as gray", () => {
    expect(computeRequirementSegments(4, 0, 0)).toMatchObject({
      completedValue: 0,
      plannedValue: 0,
      remainingValue: 4,
      green: 0,
      yellow: 0,
      gray: 4,
    });
  });

  it("planned value is clamped to only the remaining requirement", () => {
    expect(computeRequirementSegments(4, 3, 3)).toMatchObject({
      completedValue: 3,
      plannedValue: 1,
      remainingValue: 0,
      green: 3,
      yellow: 1,
      gray: 0,
    });
  });
});

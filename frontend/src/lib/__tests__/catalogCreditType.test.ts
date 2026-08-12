import { describe, it, expect } from "vitest";
import { effectiveCreditType, formatCreditType } from "@/lib/catalog";

describe("effectiveCreditType", () => {
  it("keeps College Prep and Accelerated as-is", () => {
    expect(effectiveCreditType("Biology", "College Prep")).toBe("College Prep");
    expect(effectiveCreditType("Biology", "Accelerated")).toBe("Accelerated");
  });

  it("treats no credit type as null", () => {
    expect(effectiveCreditType("Biology", null)).toBeNull();
    expect(effectiveCreditType("Biology", undefined)).toBeNull();
  });

  it("keeps true honors courses as Honors", () => {
    expect(effectiveCreditType("Algebra 2 Honors", "Honors")).toBe("Honors");
    expect(effectiveCreditType("Physics Honors", "Honors")).toBe("Honors");
  });

  it("derives AP from the AP title prefix on honors-stored courses", () => {
    expect(effectiveCreditType("AP Biology", "Honors")).toBe("AP");
    expect(effectiveCreditType("AP Calculus AB", "Honors")).toBe("AP");
    expect(effectiveCreditType("AP Precalculus", "Honors")).toBe("AP");
  });

  it("keeps an explicit AP credit type as AP regardless of title", () => {
    expect(effectiveCreditType("Biology", "AP")).toBe("AP");
    expect(effectiveCreditType("AP Biology", "AP")).toBe("AP");
  });

  it("does not mistake AP letter fragments for the AP prefix", () => {
    expect(effectiveCreditType("Mobile App Development", "Honors")).toBe("Honors");
    expect(effectiveCreditType("Photography", "Honors")).toBe("Honors");
  });
});

describe("formatCreditType", () => {
  it("returns null for empty input", () => {
    expect(formatCreditType(null)).toBeNull();
    expect(formatCreditType(undefined)).toBeNull();
    expect(formatCreditType("")).toBeNull();
  });

  it("returns the credit type unchanged without a title", () => {
    expect(formatCreditType("Honors")).toBe("Honors");
    expect(formatCreditType("College Prep")).toBe("College Prep");
  });

  it("uses the title to derive AP when present", () => {
    expect(formatCreditType("Honors", "AP Physics 1")).toBe("AP");
    expect(formatCreditType("Honors", "Physics Honors")).toBe("Honors");
  });
});
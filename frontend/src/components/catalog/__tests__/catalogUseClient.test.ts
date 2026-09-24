import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const COMPONENTS_DIR = join(__dirname, "..");

const CATALOG_DETAIL_COMPONENTS = [
  "CourseDetailHeader.tsx",
  "CourseDescription.tsx",
  "CourseOfferings.tsx",
  "CoursePrerequisites.tsx",
  "CourseRequiredFor.tsx",
  "CourseAttributes.tsx",
];

describe("Catalog detail components have 'use client' directive", () => {
  for (const filename of CATALOG_DETAIL_COMPONENTS) {
    it(`${filename} starts with "use client"`, () => {
      const filePath = join(COMPONENTS_DIR, filename);
      const content = readFileSync(filePath, "utf-8");
      expect(content.trimStart().startsWith('"use client"')).toBe(true);
    });
  }
});

describe("CourseCard has data-course-slug attribute", () => {
  it("CourseCard.tsx includes data-course-slug={slug}", () => {
    const filePath = join(COMPONENTS_DIR, "CourseCard.tsx");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("data-course-slug={slug}");
  });

  it("CourseCard.tsx sets data-tutorial-target only for algebra-1 slug", () => {
    const filePath = join(COMPONENTS_DIR, "CourseCard.tsx");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain('data-tutorial-target={slug === "algebra-1" ? "course-algebra-1" : undefined}');
  });

  it("only CourseCard.tsx emits data-tutorial-target='course-algebra-1'", () => {
    const files = ["CourseCard.tsx", "CourseGrid.tsx", "CourseOfferings.tsx", "CoursePrerequisites.tsx"];
    let algebraTargetSources = 0;
    for (const filename of files) {
      const content = readFileSync(join(COMPONENTS_DIR, filename), "utf-8");
      if (content.includes("course-algebra-1")) algebraTargetSources += 1;
    }
    expect(algebraTargetSources).toBe(1);
  });
});

describe("Catalog detail sections have distinct data-tutorial-target attributes", () => {
  it("CourseOfferings.tsx includes data-tutorial-target='course-offerings'", () => {
    const content = readFileSync(join(COMPONENTS_DIR, "CourseOfferings.tsx"), "utf-8");
    expect(content).toContain('data-tutorial-target="course-offerings"');
  });

  it("CoursePrerequisites.tsx includes data-tutorial-target='course-prerequisites'", () => {
    const content = readFileSync(join(COMPONENTS_DIR, "CoursePrerequisites.tsx"), "utf-8");
    expect(content).toContain('data-tutorial-target="course-prerequisites"');
  });

  it("offerings and prerequisites targets are distinct values", () => {
    const offerings = readFileSync(join(COMPONENTS_DIR, "CourseOfferings.tsx"), "utf-8");
    const prerequisites = readFileSync(join(COMPONENTS_DIR, "CoursePrerequisites.tsx"), "utf-8");
    expect(offerings).toContain('data-tutorial-target="course-offerings"');
    expect(prerequisites).toContain('data-tutorial-target="course-prerequisites"');
    expect(offerings).not.toContain('data-tutorial-target="course-prerequisites"');
    expect(prerequisites).not.toContain('data-tutorial-target="course-offerings"');
  });
});

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
});

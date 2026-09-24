import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PAGE_PATH = join(__dirname, "..", "page.tsx");

describe("Graduation Progress credits denominator", () => {
  const source = readFileSync(PAGE_PATH, "utf-8");

  it("does not render a literal '/ {TOTAL_REQUIRED_CREDITS}' next to the i18n key", () => {
    // The i18n key requirements.creditsCompleted already includes "/ {total}".
    // A second literal "/ {TOTAL_REQUIRED_CREDITS}" produced "36 / 45 / 45 Credits Completed".
    expect(source).not.toMatch(
      /\/\s*\{TOTAL_REQUIRED_CREDITS\}\s*\{t\("requirements\.creditsCompleted"/
    );
  });

  it("still renders requirements.creditsCompleted with the total parameter", () => {
    expect(source).toContain(
      't("requirements.creditsCompleted", { total: String(TOTAL_REQUIRED_CREDITS) })'
    );
  });

  it("creditsCompleted appears in both mobile and desktop branches", () => {
    const matches = source.match(
      /t\("requirements\.creditsCompleted",\s*\{\s*total:\s*String\(TOTAL_REQUIRED_CREDITS\)\s*\}\)/g
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it("TOTAL_REQUIRED_CREDITS remains 45", () => {
    expect(source).toContain("const TOTAL_REQUIRED_CREDITS = 45");
  });

  it("does not change projectedCredits formatting key usage", () => {
    expect(source).toContain(
      't("requirements.projectedCredits", { earned: formatNumber(projectedCreditsTotal), total: String(TOTAL_REQUIRED_CREDITS) })'
    );
  });
});

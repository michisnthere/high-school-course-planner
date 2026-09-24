import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { translate, AVAILABLE_LOCALES } from "@/lib/i18n";

const SRC_DIR = join(__dirname, "..", "..");

const DECORATIVE_SYMBOLS = ["←", "→", "✓", "✕", "×", "⚠", "★"] as const;

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function walkTsxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      if (entry === "__tests__") continue;
      files.push(...walkTsxFiles(fullPath));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("static scan: JSX symbol composed with a translation containing the same symbol", () => {
  it("finds no duplicate decorative symbol compositions in .tsx sources", () => {
    const violations: string[] = [];

    for (const file of walkTsxFiles(SRC_DIR)) {
      const content = readFileSync(file, "utf8");

      for (const match of content.matchAll(
        /((?:[←→✓✕×⚠★][ \t]*)+)\{t\("([^"]+)"/g
      )) {
        const prefix = match[1];
        const key = match[2];
        const value = translate("en", key);
        for (const symbol of DECORATIVE_SYMBOLS) {
          if (prefix.includes(symbol) && value.includes(symbol)) {
            violations.push(
              `${file}: "${symbol}" rendered in JSX right before t("${key}") which already contains "${symbol}"`
            );
          }
        }
      }

      for (const match of content.matchAll(
        /\{t\("([^"]+)"\)\}[ \t]*(&rarr;|&larr;|←|→|✓|✕|×|⚠|★)/g
      )) {
        const key = match[1];
        const entity = match[2];
        const symbol =
          entity === "&rarr;" ? "→" : entity === "&larr;" ? "←" : entity;
        const value = translate("en", key);
        if (value.includes(symbol)) {
          violations.push(
            `${file}: t("${key}") followed by "${entity}" but the translation already contains "${symbol}"`
          );
        }
      }

      for (const match of content.matchAll(/\{(\w+)\}[ \t]*(&rarr;|&larr;)/g)) {
        const identifier = match[1];
        const symbol = match[2] === "&rarr;" ? "→" : "←";
        const assignment = content.match(
          new RegExp(`${identifier}=\\{t\\("([^"]+)"`)
        );
        if (!assignment) continue;
        const key = assignment[1];
        const value = translate("en", key);
        if (value.includes(symbol)) {
          violations.push(
            `${file}: {${identifier}} followed by "${match[2]}" where ${identifier}=t("${key}") already contains "${symbol}"`
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

describe("component-supplied symbols stay out of every locale", () => {
  const componentSupplied: Array<{ key: string; symbol: string }> = [
    { key: "planner.backToPlanner", symbol: "←" },
    { key: "planner.completedBadge", symbol: "✓" },
    { key: "dashboard.openPlanner", symbol: "→" },
  ];

  for (const { key, symbol } of componentSupplied) {
    it(`"${key}" has no "${symbol}" in any locale`, () => {
      for (const { code } of AVAILABLE_LOCALES) {
        const value = translate(code, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
        expect(value).not.toContain(symbol);
      }
    });
  }
});

describe("Back link (planner page)", () => {
  const source = readFileSync(
    join(SRC_DIR, "app", "planner", "[year]", "page.tsx"),
    "utf8"
  );
  const matches = Array.from(
    source.matchAll(/((?:←[ \t]*)+)\{t\("planner\.backToPlanner"\)\}/g)
  );

  it("the component renders the back arrow itself", () => {
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders exactly one arrow and one translated label in every locale", () => {
    for (const match of matches) {
      const arrowPrefix = match[1];
      for (const { code } of AVAILABLE_LOCALES) {
        const label = translate(code, "planner.backToPlanner");
        const visible = arrowPrefix + label;
        expect(countOccurrences(visible, "←")).toBe(1);
        expect(countOccurrences(arrowPrefix, "←")).toBe(1);
        expect(visible).toContain(label);
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it("English renders exactly \u2190 Back to Planner", () => {
    const match = matches[0];
    expect(match).toBeDefined();
    const visible = match![1] + translate("en", "planner.backToPlanner");
    expect(visible).toBe("\u2190 Back to Planner");
  });
});

describe("Completed status (planner page)", () => {
  const source = readFileSync(
    join(SRC_DIR, "app", "planner", "[year]", "page.tsx"),
    "utf8"
  );
  const matches = Array.from(
    source.matchAll(/((?:✓[ \t]*)+)\{t\("planner\.completedBadge"\)\}/g)
  );

  it("the component renders the check itself", () => {
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders exactly one check and one translated label in every locale", () => {
    for (const match of matches) {
      const checkPrefix = match[1];
      for (const { code } of AVAILABLE_LOCALES) {
        const label = translate(code, "planner.completedBadge");
        const visible = checkPrefix + label;
        expect(countOccurrences(visible, "✓")).toBe(1);
        expect(countOccurrences(checkPrefix, "✓")).toBe(1);
        expect(visible).toContain(label);
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it("English renders exactly \u2713 Completed", () => {
    const match = matches[0];
    expect(match).toBeDefined();
    const visible = match![1] + translate("en", "planner.completedBadge");
    expect(visible).toBe("\u2713 Completed");
  });
});

describe("Open Planner link (dashboard)", () => {
  const source = readFileSync(join(SRC_DIR, "app", "page.tsx"), "utf8");

  it("the component renders the trailing arrow itself", () => {
    expect(source).toMatch(/\{plannerLinkText\} &rarr;/);
    expect(source).toMatch(/plannerLinkText=\{t\("dashboard\.openPlanner"\)\}/);
  });

  it("renders exactly one arrow and one translated label in every locale", () => {
    for (const { code } of AVAILABLE_LOCALES) {
      const label = translate(code, "dashboard.openPlanner");
      const visible = `${label} \u2192`;
      expect(countOccurrences(visible, "→")).toBe(1);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("English renders exactly 'Open Planner \u2192'", () => {
    expect(`${translate("en", "dashboard.openPlanner")} \u2192`).toBe(
      "Open Planner \u2192"
    );
  });
});

describe("Graduation impact warning (planner page)", () => {
  const source = readFileSync(
    join(SRC_DIR, "app", "planner", "[year]", "page.tsx"),
    "utf8"
  );

  it("the grad message itself carries no warning symbol", () => {
    const gradMsg = source.match(/const gradMsg =[\s\S]*?;/);
    expect(gradMsg).not.toBeNull();
    expect(gradMsg![0]).not.toContain("⚠");
  });

  it("the render site supplies the status symbol based on the impact type", () => {
    expect(source).toContain(
      '{pendingPlan.gradImpact.type === "warning" ? "⚠ " : "✓ "}{pendingPlan.gradImpact.message}'
    );
  });
});

describe("Adjacent planner banner strings stay symbol-free", () => {
  const symbolFreeKeys = [
    "planner.viewOnlyMode",
    "planner.mobilePlannerTitle",
    "planner.desktopPlannerTitle",
  ];

  for (const key of symbolFreeKeys) {
    it(`"${key}" contains no decorative symbols in any locale`, () => {
      for (const { code } of AVAILABLE_LOCALES) {
        const value = translate(code, key);
        expect(value).not.toBe(key);
        for (const symbol of DECORATIVE_SYMBOLS) {
          expect(value).not.toContain(symbol);
        }
      }
    });
  }

  it("English view-only banner text is exact", () => {
    expect(translate("en", "planner.viewOnlyMode")).toBe(
      "This planner is in view-only mode."
    );
    expect(translate("en", "planner.mobilePlannerTitle", { yearLabel: "Freshman" })).toBe(
      "Freshman Planner"
    );
  });
});

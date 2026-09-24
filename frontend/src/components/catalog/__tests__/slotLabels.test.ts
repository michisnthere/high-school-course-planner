import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { AVAILABLE_LOCALES, translate } from "@/lib/i18n";

describe("planner slot labels", () => {
  it("interpolates empty planner slot numbers in every locale", () => {
    for (const { code } of AVAILABLE_LOCALES) {
      for (const slot of [1, 2, 3, 7]) {
        const label = translate(code, "planner.slotLabel", { slot: String(slot) });
        expect(label).toContain(String(slot));
        expect(label).not.toMatch(/\{slot\}|\{n\}/);
      }
    }
  });

  it("uses the numbered option key with its matching parameter in the saved-course dialog", () => {
    const source = readFileSync(join(__dirname, "..", "SavedToPlannerModal.tsx"), "utf-8");
    expect(source).toContain('t("savedToPlannerModal.slotLabel", { n: String(i + 1) })');
    expect(source).toContain('{t("savedToPlannerModal.slot")}');
    for (const { code } of AVAILABLE_LOCALES) {
      for (const slot of [1, 2, 3, 7]) {
        const label = translate(code, "savedToPlannerModal.slotLabel", { n: String(slot) });
        expect(label).toContain(String(slot));
        expect(label).not.toMatch(/\{slot\}|\{n\}/);
      }
    }
  });
});
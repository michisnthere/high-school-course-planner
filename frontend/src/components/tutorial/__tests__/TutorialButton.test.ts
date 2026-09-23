import { describe, it, expect } from "vitest";
import { translate } from "@/lib/i18n";

describe("Tutorial button i18n", () => {
  const requiredKeys = ["tutorial.buttonLabel"];

  it("has tutorial.buttonLabel in en.json", () => {
    const value = translate("en", "tutorial.buttonLabel");
    expect(value).not.toBe("tutorial.buttonLabel");
    expect(value).toBeTruthy();
  });

  it("has tutorial.buttonLabel in es.json", () => {
    const value = translate("es", "tutorial.buttonLabel");
    expect(value).not.toBe("tutorial.buttonLabel");
  });

  it("has tutorial.buttonLabel in zh-CN.json", () => {
    const value = translate("zh-CN", "tutorial.buttonLabel");
    expect(value).not.toBe("tutorial.buttonLabel");
  });

  it("has tutorial.buttonLabel in ru.json", () => {
    const value = translate("ru", "tutorial.buttonLabel");
    expect(value).not.toBe("tutorial.buttonLabel");
  });

  it("has tutorial.buttonLabel in ko.json", () => {
    const value = translate("ko", "tutorial.buttonLabel");
    expect(value).not.toBe("tutorial.buttonLabel");
  });
});

describe("TutorialButton component", () => {
  it("can be imported from the module", async () => {
    const mod = await import("@/components/tutorial/TutorialButton");
    expect(mod.TutorialButton).toBeDefined();
    expect(typeof mod.TutorialButton).toBe("function");
  });
});

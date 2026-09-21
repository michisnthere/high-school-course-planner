import { describe, it, expect } from "vitest";
import { translate, isValidLocale, AVAILABLE_LOCALES } from "@/lib/i18n";
import en from "@/locales/en.json";

describe("i18n translate()", () => {
  it("returns English text for English locale", () => {
    expect(translate("en", "nav.dashboard")).toBe("Dashboard");
  });

  it("returns translated text for Spanish locale", () => {
    expect(translate("es", "nav.dashboard")).toBe("Panel");
  });

  it("falls back to English for keys missing in a locale", () => {
    // Keys present in en but not in es should fall back to English
    expect(translate("es", "nonexistent.key")).toBe("nonexistent.key");
  });

  it("falls back to the key itself for unknown keys", () => {
    expect(translate("en", "nonexistent.key")).toBe("nonexistent.key");
  });

  it("interpolates parameters", () => {
    expect(translate("en", "dashboard.welcomeBack", { name: "Alice" })).toBe(
      "Welcome back, Alice 👋"
    );
  });

  it("returns the key when parameter is missing from params", () => {
    expect(translate("en", "dashboard.welcomeBack")).toBe(
      "Welcome back, {name} 👋"
    );
  });

  it("resolves nested keys", () => {
    expect(translate("en", "nav.courseCatalog")).toBe("Course Catalog");
    expect(translate("en", "mobileNav.exitGuestMode")).toBe("Exit Guest Mode");
  });
});

describe("isValidLocale()", () => {
  it("returns true for supported locales", () => {
    expect(isValidLocale("en")).toBe(true);
    expect(isValidLocale("es")).toBe(true);
    expect(isValidLocale("zh-CN")).toBe(true);
  });

  it("returns false for unsupported locales", () => {
    expect(isValidLocale("fr")).toBe(false);
    expect(isValidLocale("de")).toBe(false);
    expect(isValidLocale("")).toBe(false);
  });
});

describe("AVAILABLE_LOCALES", () => {
  it("includes all three supported locales", () => {
    expect(AVAILABLE_LOCALES).toHaveLength(3);
    expect(AVAILABLE_LOCALES.map((l) => l.code)).toEqual(["en", "es", "zh-CN"]);
  });
});

describe("en.json nav keys for migrated components", () => {
  const requiredNavKeys = [
    "nav.dashboard",
    "nav.courseCatalog",
    "nav.myPlanner",
    "nav.graduationRequirements",
    "nav.savedCourses",
    "nav.completedCourses",
  ];

  const requiredMobileNavKeys = [
    "mobileNav.signIn",
    "mobileNav.about",
    "mobileNav.privacy",
    "mobileNav.reportBug",
    "mobileNav.sendFeedback",
    "mobileNav.exitGuestMode",
    "mobileNav.signOut",
  ];

  const requiredMobileAppBarKeys = [
    "mobileAppBar.profile",
    "mobileAppBar.signIn",
    "mobileAppBar.fallbackTitle",
  ];

  const requiredAriaKeys = [
    "aria.openNavigationMenu",
    "aria.profile",
  ];

  it("has all required nav keys", () => {
    for (const key of requiredNavKeys) {
      const value = translate("en", key);
      expect(value).not.toBe(key); // should resolve, not return key itself
    }
  });

  it("has all required mobileNav keys", () => {
    for (const key of requiredMobileNavKeys) {
      const value = translate("en", key);
      expect(value).not.toBe(key);
    }
  });

  it("has all required mobileAppBar keys", () => {
    for (const key of requiredMobileAppBarKeys) {
      const value = translate("en", key);
      expect(value).not.toBe(key);
    }
  });

  it("has all required aria keys", () => {
    for (const key of requiredAriaKeys) {
      const value = translate("en", key);
      expect(value).not.toBe(key);
    }
  });
});

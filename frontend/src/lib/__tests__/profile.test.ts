import { describe, it, expect } from "vitest";
import { translate } from "@/lib/i18n";

describe("Profile i18n keys", () => {
  const requiredProfileKeys = [
    "profile.heading",
    "profile.description",
    "profile.signInRequired",
    "profile.headerDescription",
    "profile.editProfile",
    "profile.completeProfile",
    "profile.saveChanges",
    "profile.saving",
    "profile.changesSaved",
    "profile.errorSaving",
    "profile.guestMode",
    "profile.classOf",
    "profile.profileInformation",
    "profile.account",
    "profile.personalization",
    "profile.academicOverview",
    "profile.firstName",
    "profile.lastName",
    "profile.preferredName",
    "profile.grade",
    "profile.expectedGraduationYear",
    "profile.email",
    "profile.name",
    "profile.notSet",
    "profile.selectGrade",
    "profile.grade9",
    "profile.grade10",
    "profile.grade11",
    "profile.grade12",
    "profile.gradeOther",
    "profile.errorFirstNameRequired",
    "profile.errorLastNameRequired",
    "profile.errorInvalidYear",
    "profile.guestAccountDescription",
    "profile.language",
    "profile.accessibility",
    "profile.tutorial",
    "profile.myPlanner",
    "profile.savedCourses",
    "profile.completedCourses",
    "profile.courseCatalog",
  ];

  it("has all required profile keys in en.json", () => {
    for (const key of requiredProfileKeys) {
      const value = translate("en", key);
      expect(value).not.toBe(key);
    }
  });

  it("has all required profile keys in es.json", () => {
    for (const key of requiredProfileKeys) {
      const value = translate("es", key);
      expect(value).not.toBe(key);
    }
  });

  it("has all required profile keys in zh-CN.json", () => {
    for (const key of requiredProfileKeys) {
      const value = translate("zh-CN", key);
      expect(value).not.toBe(key);
    }
  });

  it("has all required profile keys in ru.json", () => {
    for (const key of requiredProfileKeys) {
      const value = translate("ru", key);
      expect(value).not.toBe(key);
    }
  });

  it("has all required profile keys in ko.json", () => {
    for (const key of requiredProfileKeys) {
      const value = translate("ko", key);
      expect(value).not.toBe(key);
    }
  });
});

describe("Navigation i18n keys", () => {
  it("has nav.myProfile in all locales", () => {
    const locales = ["en", "es", "zh-CN", "ru", "ko"] as const;
    for (const locale of locales) {
      const value = translate(locale, "nav.myProfile");
      expect(value).not.toBe("nav.myProfile");
    }
  });

  it("has aria.myProfile in all locales", () => {
    const locales = ["en", "es", "zh-CN", "ru", "ko"] as const;
    for (const locale of locales) {
      const value = translate(locale, "aria.myProfile");
      expect(value).not.toBe("aria.myProfile");
    }
  });
});

describe("AuthUser profile fields", () => {
  it("GUEST_USER has null profile fields", async () => {
    const { GUEST_USER } = await import("@/lib/auth");
    expect(GUEST_USER.firstName).toBeNull();
    expect(GUEST_USER.lastName).toBeNull();
    expect(GUEST_USER.preferredName).toBeNull();
    expect(GUEST_USER.grade).toBeNull();
    expect(GUEST_USER.graduationYear).toBeNull();
  });

  it("ProfileUpdateData type accepts expected fields", async () => {
    const { updateProfile } = await import("@/lib/auth");
    expect(typeof updateProfile).toBe("function");
  });
});

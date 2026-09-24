import { describe, it, expect } from "vitest";
import { translate } from "@/lib/i18n";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import zhCN from "@/locales/zh-CN.json";
import ru from "@/locales/ru.json";
import ko from "@/locales/ko.json";

const REQUIRED_PRIVACY_KEYS = [
  "privacy.heading",
  "privacy.lastUpdated",
  "privacy.intro",
  "privacy.signedInUsers",
  "privacy.signedInDescription",
  "privacy.signedInItem1",
  "privacy.signedInItem2",
  "privacy.signedInItem3",
  "privacy.signedInItem4",
  "privacy.signedInItem5",
  "privacy.signedInItem6",
  "privacy.signedInItem7",
  "privacy.signedInNote",
  "privacy.guestUsers",
  "privacy.guestIntro",
  "privacy.guestMemory",
  "privacy.guestSaved",
  "privacy.guestLocal",
  "privacy.guestSignIn",
  "privacy.howWeUse",
  "privacy.howWeUseDescription",
  "privacy.notCollected",
  "privacy.notCollectedDescription",
  "privacy.cookies",
  "privacy.cookiesDescription",
  "privacy.thirdParty",
  "privacy.thirdPartyIntro",
  "privacy.thirdPartyGoogleAuth",
  "privacy.thirdPartyVercel",
  "privacy.thirdPartyRender",
  "privacy.thirdPartyNeon",
  "privacy.thirdPartyForms",
  "privacy.thirdPartyNote",
  "privacy.dataSharing",
  "privacy.dataSharingDescription",
  "privacy.dataSharingNote",
  "privacy.security",
  "privacy.securityDescription",
  "privacy.retention",
  "privacy.retentionDescription",
  "privacy.accountDeletion",
  "privacy.accountDeletionDescription",
  "privacy.userChoices",
  "privacy.userChoicesDescription",
  "privacy.childrenUnder13",
  "privacy.childrenUnder13Description",
  "privacy.schoolRecords",
  "privacy.schoolRecordsDescription",
  "privacy.changes",
  "privacy.changesDescription",
  "privacy.contact",
  "privacy.contactDescription",
] as const;

// Must match the keys used by DeleteAccountSection.tsx and profile/page.tsx.
const REQUIRED_DELETE_ACCOUNT_KEYS = [
  "profile.deleteAccount",
  "profile.deleteAccountDescription",
  "profile.deleteAccountConfirmTitle",
  "profile.deleteAccountConfirmBody",
  "profile.deleteAccountConfirmButton",
  "profile.deleteAccountDeleting",
  "profile.deleteAccountError",
] as const;

type Dict = Record<string, unknown>;

const localeDicts: Record<string, Dict> = {
  en: en as unknown as Dict,
  es: es as unknown as Dict,
  "zh-CN": zhCN as unknown as Dict,
  ru: ru as unknown as Dict,
  ko: ko as unknown as Dict,
};

function hasStringPath(dict: Dict, dotted: string): boolean {
  let current: unknown = dict;
  for (const part of dotted.split(".")) {
    if (typeof current !== "object" || current === null) return false;
    current = (current as Dict)[part];
  }
  return typeof current === "string" && current.length > 0;
}

describe("privacy policy translations", () => {
  it("every locale provides all privacy keys as non-empty strings (raw JSON, no fallback masking)", () => {
    for (const [code, dict] of Object.entries(localeDicts)) {
      for (const key of REQUIRED_PRIVACY_KEYS) {
        expect(hasStringPath(dict, key), `${code}: ${key}`).toBe(true);
      }
    }
  });

  it("every locale provides the account deletion keys used by the UI", () => {
    for (const [code, dict] of Object.entries(localeDicts)) {
      for (const key of REQUIRED_DELETE_ACCOUNT_KEYS) {
        expect(hasStringPath(dict, key), `${code}: ${key}`).toBe(true);
      }
    }
  });

  it("no locale still ships a privacy.guestDescription key (removed in the rewrite)", () => {
    for (const [code, dict] of Object.entries(localeDicts)) {
      const privacy = dict.privacy as Dict | undefined;
      expect(privacy && "guestDescription" in privacy, code).toBeFalsy();
    }
  });

  it("English privacy heading and last-updated date are correct", () => {
    expect(translate("en", "privacy.heading")).toBe("Privacy");
    expect(translate("en", "privacy.lastUpdated")).toBe(
      "Last updated: September 23, 2026"
    );
  });

  it("English contact description includes a real contact email (not a placeholder)", () => {
    const value = translate("en", "privacy.contactDescription");
    expect(value).toContain("m.xu711@gmail.com");
    expect(value).not.toContain("[PRIVACY CONTACT EMAIL");
  });
});

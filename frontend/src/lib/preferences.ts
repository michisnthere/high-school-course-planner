"use client";

export const PREFERENCES_STORAGE_KEY = "stevenson-preferences";

export type ReducedMotionOption = "system" | "on" | "off";

export type Locale = "en" | "es" | "zh-CN";

export const CURRENT_TUTORIAL_VERSION = 1;

export type Preferences = {
  keyboardShortcuts: boolean;
  reducedMotion: ReducedMotionOption;
  largerText: boolean;
  locale: Locale;
  tutorialCompleted: boolean;
  tutorialVersion: number;
};

export const DEFAULT_PREFERENCES: Preferences = {
  keyboardShortcuts: false,
  reducedMotion: "system",
  largerText: false,
  locale: "en",
  tutorialCompleted: false,
  tutorialVersion: 0,
};

export function normalizePreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object") return DEFAULT_PREFERENCES;

  const parsed = value as Partial<Preferences>;
  const validLocales: Locale[] = ["en", "es", "zh-CN"];
  return {
    keyboardShortcuts:
      typeof parsed.keyboardShortcuts === "boolean"
        ? parsed.keyboardShortcuts
        : DEFAULT_PREFERENCES.keyboardShortcuts,
    reducedMotion:
      parsed.reducedMotion === "on" ||
      parsed.reducedMotion === "off" ||
      parsed.reducedMotion === "system"
        ? parsed.reducedMotion
        : DEFAULT_PREFERENCES.reducedMotion,
    largerText:
      typeof parsed.largerText === "boolean"
        ? parsed.largerText
        : DEFAULT_PREFERENCES.largerText,
    locale:
      typeof parsed.locale === "string" &&
      validLocales.includes(parsed.locale as Locale)
        ? (parsed.locale as Locale)
        : DEFAULT_PREFERENCES.locale,
    tutorialCompleted:
      typeof parsed.tutorialCompleted === "boolean"
        ? parsed.tutorialCompleted
        : DEFAULT_PREFERENCES.tutorialCompleted,
    tutorialVersion:
      typeof parsed.tutorialVersion === "number" && parsed.tutorialVersion >= 0
        ? parsed.tutorialVersion
        : DEFAULT_PREFERENCES.tutorialVersion,
  };
}

export function loadPreferencesFromStorage(
  storage: Pick<Storage, "getItem"> | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): Preferences {
  if (!storage) return DEFAULT_PREFERENCES;

  try {
    const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferencesToStorage(
  prefs: Preferences,
  storage: Pick<Storage, "setItem"> | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): void {
  if (!storage) return;

  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable, disabled, or full.
  }
}

export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined") return false;
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const tagName = target.tagName.toLowerCase();
  if (tagName === "textarea" || tagName === "select") return true;

  if (tagName !== "input") {
    return target.closest('[contenteditable="true"]') !== null;
  }

  const input = target as HTMLInputElement;
  const type = input.type.toLowerCase();
  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(type);
}

export function shouldHandleApplicationShortcut(
  event: KeyboardEvent,
  preferences: Pick<Preferences, "keyboardShortcuts">
): boolean {
  return preferences.keyboardShortcuts && !isTextEntryTarget(event.target);
}

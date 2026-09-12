import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  loadPreferencesFromStorage,
  normalizePreferences,
  savePreferencesToStorage,
  shouldHandleApplicationShortcut,
  type Preferences,
} from "@/lib/preferences";

// Minimal localStorage mock for Node test environment
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
  get length() { return Object.keys(storage).length; },
  key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
};

vi.stubGlobal("localStorage", mockLocalStorage);

describe("Preferences localStorage persistence", () => {
  beforeEach(() => {
    localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    vi.clearAllMocks();
  });

  it("returns defaults when no preferences are stored", () => {
    expect(loadPreferencesFromStorage(localStorage)).toEqual(DEFAULT_PREFERENCES);
  });

  it("stores and retrieves preferences", () => {
    const prefs: Preferences = {
      keyboardShortcuts: true,
      reducedMotion: "on",
      largerText: false,
    };
    savePreferencesToStorage(prefs, localStorage);
    expect(loadPreferencesFromStorage(localStorage)).toEqual(prefs);
  });

  it("handles corrupted data gracefully", () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, "not-valid-json{{{");
    expect(loadPreferencesFromStorage(localStorage)).toEqual(DEFAULT_PREFERENCES);
  });

  it("defaults missing fields", () => {
    expect(normalizePreferences({ keyboardShortcuts: true })).toEqual({
      keyboardShortcuts: true,
      reducedMotion: "system",
      largerText: false,
    });
  });

  it("ignores invalid reduced motion values", () => {
    expect(
      normalizePreferences({
        keyboardShortcuts: true,
        reducedMotion: "sometimes",
        largerText: true,
      })
    ).toEqual({
      keyboardShortcuts: true,
      reducedMotion: "system",
      largerText: true,
    });
  });

  it("does not handle future application shortcuts when disabled", () => {
    const event = { target: null } as KeyboardEvent;
    expect(
      shouldHandleApplicationShortcut(event, { keyboardShortcuts: false })
    ).toBe(false);
  });
});

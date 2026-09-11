import { describe, it, expect, beforeEach, vi } from "vitest";

const STORAGE_KEY = "stevenson-preferences";

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

function loadPrefs(): Record<string, unknown> | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

describe("Preferences localStorage persistence", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    vi.clearAllMocks();
  });

  it("returns null when no preferences are stored", () => {
    expect(loadPrefs()).toBeNull();
  });

  it("stores and retrieves preferences", () => {
    const prefs = {
      keyboardShortcuts: true,
      reducedMotion: "on",
      largerText: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    expect(loadPrefs()).toEqual(prefs);
  });

  it("handles corrupted data gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");
    expect(loadPrefs()).toBeNull();
  });

  it("defaults missing fields", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ keyboardShortcuts: true }));
    const result = loadPrefs();
    expect(result).toEqual({ keyboardShortcuts: true });
  });
});

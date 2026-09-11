"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

const STORAGE_KEY = "stevenson-preferences";

type ReducedMotionOption = "system" | "on" | "off";

type Preferences = {
  keyboardShortcuts: boolean;
  reducedMotion: ReducedMotionOption;
  largerText: boolean;
};

type PreferencesContextType = {
  preferences: Preferences;
  setKeyboardShortcuts: (enabled: boolean) => void;
  setReducedMotion: (option: ReducedMotionOption) => void;
  setLargerText: (enabled: boolean) => void;
  /** Whether reduced motion is currently active (either user-chosen or system preference). */
  isReducedMotionActive: boolean;
};

const DEFAULTS: Preferences = {
  keyboardShortcuts: false,
  reducedMotion: "system",
  largerText: false,
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      keyboardShortcuts:
        typeof parsed.keyboardShortcuts === "boolean"
          ? parsed.keyboardShortcuts
          : DEFAULTS.keyboardShortcuts,
      reducedMotion:
        parsed.reducedMotion === "on" ||
        parsed.reducedMotion === "off" ||
        parsed.reducedMotion === "system"
          ? parsed.reducedMotion
          : DEFAULTS.reducedMotion,
      largerText:
        typeof parsed.largerText === "boolean"
          ? parsed.largerText
          : DEFAULTS.largerText,
    };
  } catch {
    return DEFAULTS;
  }
}

function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

function useSystemReducedMotion(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return matches;
}

export function PreferencesProvider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const systemReducedMotion = useSystemReducedMotion();

  // Hydrate from localStorage after mount (avoid SSR mismatch).
  useEffect(() => {
    setPreferences(loadPreferences());
    setHydrated(true);
  }, []);

  // Persist whenever preferences change (after hydration).
  useEffect(() => {
    if (hydrated) {
      savePreferences(preferences);
    }
  }, [preferences, hydrated]);

  // Compute whether reduced motion is active.
  const isReducedMotionActive =
    preferences.reducedMotion === "on" ||
    (preferences.reducedMotion === "system" && systemReducedMotion);

  // Apply CSS classes to <html> for reduced motion and larger text.
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (isReducedMotionActive) {
      root.classList.add("rs-reduced-motion");
    } else {
      root.classList.remove("rs-reduced-motion");
    }
    if (preferences.largerText) {
      root.classList.add("rs-larger-text");
    } else {
      root.classList.remove("rs-larger-text");
    }
  }, [isReducedMotionActive, preferences.largerText, hydrated]);

  const setKeyboardShortcuts = useCallback((enabled: boolean) => {
    setPreferences((prev) => ({ ...prev, keyboardShortcuts: enabled }));
  }, []);

  const setReducedMotion = useCallback((option: ReducedMotionOption) => {
    setPreferences((prev) => ({ ...prev, reducedMotion: option }));
  }, []);

  const setLargerText = useCallback((enabled: boolean) => {
    setPreferences((prev) => ({ ...prev, largerText: enabled }));
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        setKeyboardShortcuts,
        setReducedMotion,
        setLargerText,
        isReducedMotionActive,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextType {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error(
      "usePreferences must be used within a PreferencesProvider"
    );
  }
  return context;
}

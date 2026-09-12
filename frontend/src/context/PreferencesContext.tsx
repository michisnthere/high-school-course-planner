"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  loadPreferencesFromStorage,
  savePreferencesToStorage,
  type Preferences,
  type ReducedMotionOption,
} from "@/lib/preferences";

type PreferencesContextType = {
  preferences: Preferences;
  setKeyboardShortcuts: (enabled: boolean) => void;
  setReducedMotion: (option: ReducedMotionOption) => void;
  setLargerText: (enabled: boolean) => void;
  /** Whether reduced motion is currently active (either user-chosen or system preference). */
  isReducedMotionActive: boolean;
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => undefined;
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => {
      if (typeof window === "undefined") return false;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    () => false
  );
}

function getInitialPreferences(): Preferences {
  return loadPreferencesFromStorage();
}

function syncPreferenceClasses(
  preferences: Preferences,
  isReducedMotionActive: boolean
): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (isReducedMotionActive) {
    root.classList.add("rs-reduced-motion");
  } else {
    root.classList.remove("rs-reduced-motion");
  }
  if (preferences.reducedMotion === "off") {
    root.classList.add("rs-motion-off");
  } else {
    root.classList.remove("rs-motion-off");
  }
  if (preferences.largerText) {
    root.classList.add("rs-larger-text");
  } else {
    root.classList.remove("rs-larger-text");
  }
}

export function PreferencesProvider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const [preferences, setPreferences] = useState<Preferences>(getInitialPreferences);
  const systemReducedMotion = useSystemReducedMotion();

  // Persist whenever preferences change.
  useEffect(() => {
    savePreferencesToStorage(preferences);
  }, [preferences]);

  // Compute whether reduced motion is active.
  const isReducedMotionActive =
    preferences.reducedMotion === "on" ||
    (preferences.reducedMotion === "system" && systemReducedMotion);

  // Apply CSS classes to <html> for reduced motion and larger text.
  useEffect(() => {
    syncPreferenceClasses(preferences, isReducedMotionActive);
  }, [isReducedMotionActive, preferences]);

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

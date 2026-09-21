"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import {
  translate,
  AVAILABLE_LOCALES,
  type Locale,
} from "@/lib/i18n";

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
  availableLocales: typeof AVAILABLE_LOCALES;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({
  locale,
  setLocale,
  children,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  children: ReactNode;
}): React.ReactElement {
  const t = useCallback(
    (key: string, params?: Record<string, string>) =>
      translate(locale, key, params),
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t, availableLocales: AVAILABLE_LOCALES }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}

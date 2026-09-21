"use client";

import React, { type ReactNode } from "react";
import { PreferencesProvider, usePreferences } from "@/context/PreferencesContext";
import { I18nProvider } from "@/context/I18nContext";

function I18nBridge({ children }: { children: ReactNode }): React.ReactElement {
  const { preferences, setLocale } = usePreferences();
  return (
    <I18nProvider locale={preferences.locale} setLocale={setLocale}>
      {children}
    </I18nProvider>
  );
}

export function ClientProviders({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <PreferencesProvider>
      <I18nBridge>{children}</I18nBridge>
    </PreferencesProvider>
  );
}

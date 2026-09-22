"use client";

import React, { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PreferencesProvider, usePreferences } from "@/context/PreferencesContext";
import { I18nProvider } from "@/context/I18nContext";
import { TutorialProvider } from "@/context/TutorialContext";
import { TutorialOverlay } from "@/components/tutorial/TutorialOverlay";

function I18nBridge({ children }: { children: ReactNode }): React.ReactElement {
  const { preferences, setLocale } = usePreferences();
  return (
    <I18nProvider locale={preferences.locale} setLocale={setLocale}>
      {children}
    </I18nProvider>
  );
}

function TutorialBridge({ children }: { children: ReactNode }): React.ReactElement {
  const { preferences, markTutorialCompleted } = usePreferences();
  const pathname = usePathname();
  return (
    <TutorialProvider
      preferences={preferences}
      onMarkCompleted={markTutorialCompleted}
      pathname={pathname}
    >
      {children}
      <TutorialOverlay />
    </TutorialProvider>
  );
}

export function ClientProviders({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <PreferencesProvider>
      <I18nBridge>
        <TutorialBridge>{children}</TutorialBridge>
      </I18nBridge>
    </PreferencesProvider>
  );
}

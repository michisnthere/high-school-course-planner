"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { AccessibilitySettingsButton } from "@/components/settings/AccessibilitySettings";
import { LanguageSettingsButton } from "@/components/settings/LanguageSettings";
import { TutorialButton } from "@/components/tutorial/TutorialButton";
import { useTranslation } from "@/context/I18nContext";

export function Header(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px",
        padding: "0 24px",
        backgroundColor: "var(--bg-header)",
        boxSizing: "border-box",
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <Image
          src="/stevensonlogo.png"
          alt={t("aria.stevensonHighSchool")}
          width={32}
          height={32}
          style={{ flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--nav-text)",
            lineHeight: 1.2,
          }}
        >
          {t("header.siteTitle")}
        </span>
      </Link>

      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <TutorialButton />
        <LanguageSettingsButton />
        <AccessibilitySettingsButton />
        <AuthStatus />
      </div>
    </header>
  );
}

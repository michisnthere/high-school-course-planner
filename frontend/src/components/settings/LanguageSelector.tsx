"use client";

import React from "react";
import { useTranslation } from "@/context/I18nContext";
import type { Locale } from "@/lib/i18n";

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "24px",
  padding: "16px 0",
};

const labelGroupStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

const descriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "14px",
  color: "var(--text-primary)",
  backgroundColor: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "8px",
  cursor: "pointer",
  outline: "none",
  flexShrink: 0,
  minWidth: "160px",
};

export function LanguageSelector(): React.ReactElement {
  const { locale, setLocale, availableLocales, t } = useTranslation();

  return (
    <div style={rowStyle}>
      <div style={labelGroupStyle}>
        <p style={labelStyle}>{t("language.label")}</p>
        <p style={descriptionStyle}>{t("language.description")}</p>
      </div>
      <div>
        <label htmlFor="language-select" style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
          {t("language.label")}
        </label>
        <select
          id="language-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          style={selectStyle}
        >
          {availableLocales.map((loc) => (
            <option key={loc.code} value={loc.code}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

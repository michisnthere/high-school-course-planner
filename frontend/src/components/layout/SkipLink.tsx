"use client";

import React from "react";
import { useTranslation } from "@/context/I18nContext";

export function SkipLink(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <a href="#main-content" className="rs-skip-link">
      {t("aria.skipToContent")}
    </a>
  );
}

import React from "react";
import { useTranslation } from "@/context/I18nContext";

export function DashboardHeader(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div style={{ marginBottom: "32px" }}>
      <h1
        style={{
          margin: 0,
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        {t("dashboard.dashboardTitle")}
      </h1>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: "16px",
          color: "var(--text-secondary)",
        }}
      >
        {t("dashboard.dashboardSubtitle")}
      </p>
    </div>
  );
}

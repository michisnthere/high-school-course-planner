import React from "react";
import { useTranslation } from "@/context/I18nContext";

export function QuickActions(): React.ReactElement {
  const { t } = useTranslation();
  const actions = [t("dashboard.browseCourses"), t("dashboard.buildMyPlanner"), t("dashboard.viewRequirements")];
  return (
    <div style={{ marginTop: "32px" }}>
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        {t("dashboard.quickActions")}
      </h2>
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            style={{
              padding: "14px 20px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-secondary)",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}

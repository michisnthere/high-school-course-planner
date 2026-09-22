import React from "react";
import { useTranslation } from "@/context/I18nContext";

type Requirement = {
  name: string;
  count: number;
};

type GraduationRequirementsSummaryProps = {
  requirements: Requirement[];
};

export function GraduationRequirementsSummary({
  requirements,
}: GraduationRequirementsSummaryProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div
      style={{
        flex: 1,
        minWidth: "300px",
        padding: "24px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "20px",
        fontWeight: 700,
        color: "var(--text-primary)",
      }}
    >
      {t("dashboard.graduationProgress")}
      </h2>

      {requirements.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "var(--text-muted)",
          }}
        >
          {t("dashboard.noRequirementsFound")}
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {requirements.map((requirement) => (
            <li
              key={requirement.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                backgroundColor: "var(--bg-input)",
                borderRadius: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {requirement.name}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  color: "var(--text-muted)",
                }}
              >
                {requirement.count} {requirement.count === 1 ? t("completedCourses.course") : t("completedCourses.courses")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

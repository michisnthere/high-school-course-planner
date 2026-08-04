import React from "react";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";
import { isGraduationRequirementVisibleForYear } from "@/lib/graduationRequirementVisibility";

type Props = {
  plannerAnalysis: PlannerAnalysis | null;
  currentYear: number;
};

const STATUS_LABELS: Record<"satisfied" | "partial" | "notStarted", string> = {
  satisfied: "Satisfied",
  partial: "In Progress",
  notStarted: "Missing",
};

export function GraduationRequirements({
  plannerAnalysis,
  currentYear,
}: Props): React.ReactElement | null {
  if (!plannerAnalysis) {
    return null;
  }

  const visible = plannerAnalysis.graduationRequirements.filter(
    (req) =>
      req.status !== "satisfied" &&
      isGraduationRequirementVisibleForYear(req.name, currentYear)
  );

  return (
    <div
      style={{
        marginTop: "24px",
        paddingTop: "20px",
        borderTop: "1px solid var(--border-default)",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: "16px",
          fontWeight: 700,
          color: "#275D38",
        }}
      >
        Graduation Requirements
      </h3>

      {visible.length === 0 ? (
        <p style={{ margin: 0, fontSize: "14px", color: "var(--status-success)" }}>
          ✓ All graduation requirements on track
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {visible.map((req) => (
            <li
              key={req.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                color: "var(--brand-accent)",
              }}
            >
              <span style={{ fontSize: "16px" }}>⚠</span>
              <span style={{ color: "var(--text-primary)" }}>{req.name}</span>
              <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                / {STATUS_LABELS[req.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

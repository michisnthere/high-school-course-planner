import React from "react";
import type { CourseLoadRequirements } from "@/lib/courseLoadRequirements";
import { formatCredits } from "@/lib/courseCredits";

type Props = {
  requirements: CourseLoadRequirements;
};

function ProgressBar({
  earned,
  required,
}: {
  earned: number;
  required: number;
}): React.ReactElement {
  const percent = required > 0 ? Math.min(100, (earned / required) * 100) : 0;
  const isMet = earned >= required;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          flex: 1,
          height: "6px",
          backgroundColor: "var(--bg-muted)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            backgroundColor: isMet ? "var(--brand-primary-hover)" : "var(--brand-accent)",
            borderRadius: "3px",
            transition: "width 400ms ease",
          }}
        />
      </div>
      <span style={{ minWidth: "70px", textAlign: "right", fontWeight: 400 }}>
        {formatCredits(earned)} / {required}
      </span>
    </div>
  );
}

export function CourseLoadRequirements({
  requirements,
}: Props): React.ReactElement | null {
  const { semesterCredits, sixthPeriod } = requirements;
  const allMet =
    semesterCredits.every((s) => s.isMet) &&
    sixthPeriod.every((s) => s.isMet);

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
        Course Load Requirements
      </h3>

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
        <li>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>
              {semesterCredits.every((s) => s.isMet) ? "✓" : "⚠"}
            </span>
            <span>At least five credits of coursework</span>
          </div>
          <div style={{ paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {semesterCredits.map((s) => (
              <div key={s.semester} style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Semester {s.semester}:</span>{" "}
                <ProgressBar earned={s.earnedCredits} required={s.requiredCredits} />
              </div>
            ))}
          </div>
        </li>

        <li>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>
              {sixthPeriod.every((s) => s.isMet) ? "✓" : "⚠"}
            </span>
            <span>A sixth supervised period</span>
          </div>
          <div style={{ paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {sixthPeriod.map((s) => (
              <div
                key={s.semester}
                style={{
                  fontSize: "13px",
                  color: s.isMet ? "var(--brand-primary-hover)" : "var(--brand-accent)",
                }}
              >
                Semester {s.semester}: {s.filledCount} / {s.requiredCount} periods filled
              </div>
            ))}
          </div>
        </li>
      </ul>
    </div>
  );
}

import React from "react";
import type { RequirementStatus, PeSemesterStatus } from "@/lib/gradeRequirements";
import type { PeWaiver } from "@/lib/plannerWaivers";

type GradeRequirementsProps = {
  grade: number;
  requirements: RequirementStatus[];
  pePerSemester?: PeSemesterStatus[];
  peWaivers?: PeWaiver[];
};

export function GradeRequirements({
  grade,
  requirements,
  pePerSemester,
  peWaivers,
}: GradeRequirementsProps): React.ReactElement | null {
  const hasWaiver = (peWaivers ?? []).length > 0;
  const showPeSection = pePerSemester && pePerSemester.length > 0;

  if (requirements.length === 0 && !showPeSection) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "24px",
        paddingTop: "20px",
        borderTop: "1px solid #374151",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: "16px",
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        Grade {grade} Requirements
      </h3>

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
        {requirements.map((requirement) => (
          <li
            key={requirement.category}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              color: requirement.isMet ? "#d1d5db" : "#fbbf24",
            }}
          >
            <span style={{ fontSize: "16px" }}>{requirement.isMet ? "✓" : "⚠"}</span>
            <span>{requirement.category}</span>
          </li>
        ))}
      </ul>

      {showPeSection && (
        <div style={{ marginTop: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              color: hasWaiver || pePerSemester!.every((s) => s.isMet) ? "#d1d5db" : "#fbbf24",
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "16px" }}>
              {hasWaiver || pePerSemester!.every((s) => s.isMet) ? "✓" : "⚠"}
            </span>
            <span>Physical Welfare / Dance / Driver Education</span>
          </div>
          {hasWaiver ? (
            <div
              style={{
                paddingLeft: "24px",
                fontSize: "13px",
                color: "#22c55e",
              }}
            >
              Waiver applied
            </div>
          ) : (
            <div style={{ paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "2px" }}>
              {pePerSemester!.map((s) => (
                <div
                  key={s.semester}
                  style={{
                    fontSize: "13px",
                    color: s.isMet ? "#22c55e" : "#f59e0b",
                  }}
                >
                  Semester {s.semester}: {s.isMet ? "✓ " : "⚠ "}
                  {s.courseTitle ?? "Missing"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

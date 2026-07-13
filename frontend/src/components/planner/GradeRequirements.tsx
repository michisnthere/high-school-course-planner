import React from "react";
import type { RequirementStatus, PeSemesterStatus } from "@/lib/gradeRequirements";
import type { PeWaiver } from "@/lib/plannerWaivers";
import { computeEffectivePeStatus } from "@/lib/gradeRequirements";

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
  const showPeSection = pePerSemester && pePerSemester.length > 0;
  const effectivePe = showPeSection
    ? computeEffectivePeStatus(pePerSemester!, peWaivers ?? [])
    : undefined;
  const allSemestersMet = effectivePe?.every((s) => s.isMet) ?? false;

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
              color: allSemestersMet ? "#d1d5db" : "#fbbf24",
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "16px" }}>
              {allSemestersMet ? "✓" : "⚠"}
            </span>
            <span>{grade === 9 ? "Physical Education" : "Physical Welfare / Dance / Driver Education"}</span>
          </div>
          <div style={{ paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "2px" }}>
            {effectivePe!.map((s) => (
              <div
                key={s.semester}
                style={{
                  fontSize: "13px",
                  color: s.isMet ? "#22c55e" : "#f59e0b",
                }}
              >
                Semester {s.semester}: {s.isMet ? "✓ " : "⚠ "}
                {s.courseTitle ?? (grade === 9 && s.semester === 1 ? "Missing Freshman Foundational Fitness" : "Missing")}
                {!s.courseTitle && s.isMet && (peWaivers ?? []).length > 0 && " (waiver)"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React from "react";
import type { RequirementStatus } from "@/lib/gradeRequirements";

type GradeRequirementsProps = {
  grade: number;
  requirements: RequirementStatus[];
};

export function GradeRequirements({
  grade,
  requirements,
}: GradeRequirementsProps): React.ReactElement | null {
  if (requirements.length === 0) {
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
    </div>
  );
}

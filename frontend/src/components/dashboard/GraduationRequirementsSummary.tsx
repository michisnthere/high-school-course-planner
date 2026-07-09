import React from "react";

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
  return (
    <div
      style={{
        flex: 1,
        minWidth: "300px",
        padding: "24px",
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "20px",
          fontWeight: 600,
          color: "#111827",
        }}
      >
        Graduation Requirements
      </h2>

      {requirements.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "#6b7280",
          }}
        >
          No graduation requirements found.
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
                backgroundColor: "#f9fafb",
                borderRadius: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                {requirement.name}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  color: "#6b7280",
                }}
              >
                {requirement.count} course{requirement.count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import React from "react";

const fields = [
  { label: "Unweighted GPA", value: "—" },
  { label: "Weighted GPA", value: "—" },
  { label: "Credits Earned", value: "—" },
  { label: "Current Grade", value: "—" },
  { label: "Planner Status", value: "Not Started" },
  { label: "Graduation Progress", value: "—" },
];

export function AcademicSnapshot(): React.ReactElement {
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
        Academic Snapshot
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {fields.map((field) => (
          <div
            key={field.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "15px",
                color: "#6b7280",
              }}
            >
              {field.label}
            </span>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 500,
                color: "#374151",
              }}
            >
              {field.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

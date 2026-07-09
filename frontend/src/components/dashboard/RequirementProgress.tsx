import React from "react";

const placeholderRequirements = [
  { label: "English", value: 8, total: 8 },
  { label: "Mathematics", value: 6, total: 6 },
  { label: "Science", value: 4, total: 4 },
  { label: "Social Studies", value: 3, total: 4 },
];

export function RequirementProgress(): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        minWidth: "280px",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "20px",
        backgroundColor: "#ffffff",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "18px",
          fontWeight: 600,
          color: "#111827",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Requirement Progress
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {placeholderRequirements.map((req) => (
          <div key={req.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
                fontSize: "14px",
                color: "#374151",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              }}
            >
              <span>{req.label}</span>
              <span>
                {req.value} / {req.total}
              </span>
            </div>
            <div
              style={{
                height: "8px",
                backgroundColor: "#e5e7eb",
                borderRadius: "9999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min((req.value / req.total) * 100, 100)}%`,
                  height: "100%",
                  backgroundColor: "#3b82f6",
                  borderRadius: "9999px",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

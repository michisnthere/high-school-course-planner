import React from "react";

const actions = ["Browse Courses", "Build My Planner", "View Requirements"];

export function QuickActions(): React.ReactElement {
  return (
    <div style={{ marginTop: "32px" }}>
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
        Quick Actions
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
              color: "#374151",
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              cursor: "pointer",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}

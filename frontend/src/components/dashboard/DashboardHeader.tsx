import React from "react";

export function DashboardHeader(): React.ReactElement {
  return (
    <div style={{ marginBottom: "32px" }}>
      <h1
        style={{
          margin: 0,
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        Dashboard
      </h1>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: "16px",
          color: "var(--text-secondary)",
        }}
      >
        Explore courses, plan your schedule, and track graduation requirements all in one place.
      </p>
    </div>
  );
}

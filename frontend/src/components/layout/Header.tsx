import React from "react";
import { AuthStatus } from "@/components/auth/AuthStatus";

/**
 * Header — top navigation bar for the Stevenson Course Planner dashboard.
 */
export function Header(): React.ReactElement {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px",
        padding: "0 24px",
        backgroundColor: "var(--bg-header)",
        borderBottom: "1px solid var(--border-default)",
        boxSizing: "border-box",
      }}
    >
      {/* Left: title */}
      <div style={{ flex: "0 0 auto" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.2,
          }}
        >
          Stevenson Course Planner
        </h1>
      </div>

      {/* Right: actions */}
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <AuthStatus />
      </div>
    </header>
  );
}

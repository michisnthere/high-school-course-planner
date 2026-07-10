import React from "react";
import { AuthStatus } from "@/components/auth/AuthStatus";

/**
 * Header — top navigation bar for the High School Course Planner dashboard.
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
        backgroundColor: "#0a0a0a",
        borderBottom: "1px solid #374151",
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
            color: "#ffffff",
            lineHeight: 1.2,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          High School Course Planner
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

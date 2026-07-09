import React from "react";

/**
 * Header — top navigation bar for the High School Course Planner dashboard.
 *
 * Placeholder component: buttons are no-ops.
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
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
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
            color: "#000000",
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
        <button
          type="button"
          style={{
            height: "40px",
            padding: "0 16px",
            fontSize: "0.9375rem",
            fontWeight: 500,
            color: "#374151",
            backgroundColor: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            cursor: "pointer",
            boxSizing: "border-box",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          Theme
        </button>
        <button
          type="button"
          style={{
            height: "40px",
            padding: "0 16px",
            fontSize: "0.9375rem",
            fontWeight: 500,
            color: "#374151",
            backgroundColor: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            cursor: "pointer",
            boxSizing: "border-box",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          Profile
        </button>
      </div>
    </header>
  );
}

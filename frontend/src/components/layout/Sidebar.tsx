"use client";

import React from "react";

/**
 * Sidebar — vertical navigation for the High School Course Planner dashboard.
 *
 * Placeholder component: navigation items are visual-only and have no routing logic.
 */
export function Sidebar(): React.ReactElement {
  const items = ["Dashboard", "Course Catalog", "My Planner", "Graduation Requirements"];

  return (
    <aside
      style={{
        width: "240px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px",
        backgroundColor: "#f9fafb",
        borderRight: "1px solid #e5e7eb",
        boxSizing: "border-box",
      }}
    >
      <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((item) => (
          <a
            key={item}
            href="#"
            style={{
              display: "block",
              padding: "10px 12px",
              fontSize: "0.9375rem",
              fontWeight: 500,
              color: "#374151",
              textDecoration: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
            onClick={(e) => e.preventDefault()}
          >
            {item}
          </a>
        ))}
      </nav>
    </aside>
  );
}

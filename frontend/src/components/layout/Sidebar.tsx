"use client";

import React from "react";
import Link from "next/link";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Course Catalog", href: "/catalog" },
  { label: "Saved Courses", href: "/saved" },
  { label: "Completed Courses", href: "/completed-courses" },
  { label: "My Planner", href: "/planner" },
  { label: "Graduation Requirements", href: "/requirements" },
];

export function Sidebar(): React.ReactElement {
  return (
    <aside
      style={{
        width: "240px",
        minHeight: "calc(100vh - 64px)",
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px",
        backgroundColor: "#f9fafb",
        borderRight: "1px solid #e5e7eb",
        boxSizing: "border-box",
      }}
    >
      <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
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
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

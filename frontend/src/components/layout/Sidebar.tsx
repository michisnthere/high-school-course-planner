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
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-default)",
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
              color: "var(--text-secondary)",
              textDecoration: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Course Catalog", href: "/catalog" },
  { label: "Saved Courses", href: "/saved" },
  { label: "Completed Courses", href: "/completed-courses" },
  { label: "My Planner", href: "/planner" },
  { label: "Graduation Requirements", href: "/requirements" },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "240px",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px",
        backgroundColor: "var(--bg-sidebar)",
        boxSizing: "border-box",
        flex: 1,
      }}
    >
      <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: "block",
                padding: "10px 12px",
                fontSize: "0.9375rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                textDecoration: "none",
                borderRadius: "8px",
                backgroundColor: isActive ? "var(--sidebar-active-bg)" : "transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

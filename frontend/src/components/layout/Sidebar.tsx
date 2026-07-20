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

const infoItems = [
  { label: "About", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Feedback", href: "/feedback" },
];

function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    display: "block",
    padding: "10px 12px",
    fontSize: "0.9375rem",
    fontWeight: isActive ? 600 : 500,
    color: isActive ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
    textDecoration: "none",
    borderRadius: "8px",
    backgroundColor: isActive ? "var(--sidebar-active-bg)" : "transparent",
  };
}

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
      <nav style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} style={navLinkStyle(pathname === item.href)}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div
        style={{
          borderTop: "1px solid var(--border-default)",
          margin: "8px 0",
          paddingTop: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {infoItems.map((item) => (
          <Link key={item.label} href={item.href} style={navLinkStyle(pathname === item.href)}>
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}

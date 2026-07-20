"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarFooter } from "./SidebarFooter";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Course Catalog", href: "/catalog" },
  { label: "Saved Courses", href: "/saved" },
  { label: "Completed Courses", href: "/completed-courses" },
  { label: "My Planner", href: "/planner" },
  { label: "Graduation Requirements", href: "/requirements" },
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
        height: "100%",
        padding: "24px 16px",
        backgroundColor: "var(--bg-sidebar)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
        <Image
          src="/stevensonlogo.png"
          alt="Stevenson High School"
          width={32}
          height={32}
          style={{ flexShrink: 0 }}
        />
        <h1
          style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--nav-text)",
            lineHeight: 1.2,
          }}
        >
          Stevenson Course Planner
        </h1>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} style={navLinkStyle(pathname === item.href)}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.15)",
          paddingTop: "12px",
        }}
      >
        <SidebarFooter />
      </div>
    </aside>
  );
}

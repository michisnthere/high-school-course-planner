"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarFooter } from "./SidebarFooter";
import { useTranslation } from "@/context/I18nContext";

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
  const { t } = useTranslation();

  const navItems = [
    { label: t("nav.dashboard"), href: "/", tourId: "nav-dashboard" },
    { label: t("nav.courseCatalog"), href: "/catalog", tourId: "nav-catalog" },
    { label: t("nav.myPlanner"), href: "/planner", tourId: "nav-planner" },
    { label: t("nav.graduationRequirements"), href: "/requirements", tourId: "nav-requirements" },
    { label: t("nav.savedCourses"), href: "/saved", tourId: "nav-saved" },
    { label: t("nav.completedCourses"), href: "/completed-courses", tourId: "nav-completed" },
  ];

  return (
    <aside
      style={{
        width: "250px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "24px 16px",
        backgroundColor: "var(--bg-sidebar)",
        boxSizing: "border-box",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
          <nav aria-label={t("aria.mainNavigation")} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tourId}
              style={navLinkStyle(pathname === item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

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

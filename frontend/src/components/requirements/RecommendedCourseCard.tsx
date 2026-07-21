"use client";

import React from "react";
import Link from "next/link";
import type { PlannerCourseDetails } from "@/lib/planner";

type RecommendedCourseCardProps = {
  course: PlannerCourseDetails;
  href: string;
  onNavigate?: (course: PlannerCourseDetails) => void;
};

export function RecommendedCourseCard({
  course,
  href,
  onNavigate,
}: RecommendedCourseCardProps): React.ReactElement {
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (!onNavigate) return;
        event.preventDefault();
        onNavigate(course);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "10px",
        textDecoration: "none",
        color: "var(--text-primary)",
        fontSize: "15px",
        fontWeight: 500,
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        cursor: "pointer",
        minHeight: "52px",
        gap: "12px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--brand-accent)";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-default)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
        {course.title}
      </span>
      <span style={{ fontSize: "18px", color: "var(--text-muted)", flexShrink: 0, lineHeight: 1 }} aria-hidden="true">
        →
      </span>
    </Link>
  );
}

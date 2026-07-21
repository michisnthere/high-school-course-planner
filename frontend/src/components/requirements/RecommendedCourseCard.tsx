"use client";

import React from "react";
import Link from "next/link";
import type { PlannerCourseDetails } from "@/lib/planner";

const CORE_SUB_REQUIREMENTS: Record<string, string[]> = {
  Science: ["Biology", "Physical Science"],
  "Social Studies": ["U.S. History", "Government", "World History and Geography"],
};

type BadgeInfo = {
  label: string;
  bg: string;
  text: string;
};

function getRelevanceBadge(
  course: PlannerCourseDetails,
  requirementName: string
): BadgeInfo {
  const fulfills = (course.fulfillsRequirements ?? []).map((r) => r.trim());

  // Core required course (fulfills a sub-requirement of this requirement)
  const subReqs = CORE_SUB_REQUIREMENTS[requirementName];
  if (subReqs) {
    for (const sub of subReqs) {
      if (fulfills.some((r) => r.toLowerCase() === sub.toLowerCase())) {
        return { label: "\u2713 Required", bg: "#dcfce7", text: "#166534" };
      }
    }
  }

  // Direct match is required for core subjects
  if (fulfills.some((r) => r.toLowerCase() === requirementName.toLowerCase())) {
    if (["English", "Mathematics", "Science", "Social Studies"].includes(requirementName)) {
      return { label: "\u2713 Required", bg: "#dcfce7", text: "#166534" };
    }
  }

  // AP / Honors
  const creditType = course.creditType;
  if (creditType === "AP") {
    return { label: "Advanced Placement", bg: "#f3e8ff", text: "#6b21a8" };
  }
  if (creditType === "Honors") {
    return { label: "Honors", bg: "#f3e8ff", text: "#6b21a8" };
  }

  // Has prerequisites
  if (course.prerequisites && course.prerequisites.length > 0) {
    const prereq = course.prerequisites[0];
    const short = prereq.length > 30 ? prereq.substring(0, 28) + "..." : prereq;
    return { label: `Requires ${short}`, bg: "#fef3c7", text: "#92400e" };
  }

  // Default
  return { label: "Recommended", bg: "#dbeafe", text: "#1e40af" };
}

function getCourseSlug(course: PlannerCourseDetails): string {
  return course.normalizedTitle || course.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type RecommendedCourseCardProps = {
  course: PlannerCourseDetails;
  requirementName: string;
  returnParams: string;
  onNavigate?: () => void;
};

export function RecommendedCourseCard({
  course,
  requirementName,
  returnParams,
  onNavigate,
}: RecommendedCourseCardProps): React.ReactElement {
  const badge = getRelevanceBadge(course, requirementName);
  const slug = getCourseSlug(course);
  const href = `/catalog/${slug}?return=${encodeURIComponent(returnParams ? `/requirements?${returnParams}` : "/requirements")}&fromRequirement=${encodeURIComponent(requirementName)}`;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        backgroundColor: "#FCF5DF",
        border: "1px solid #ECBA2B",
        borderRadius: "8px",
        textDecoration: "none",
        color: "#111827",
        fontSize: "14px",
        fontWeight: 500,
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        cursor: "pointer",
        minHeight: "44px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#d4a01e";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(236,186,43,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#ECBA2B";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {course.title}
        </span>
        {course.department && (
          <span style={{ fontSize: "12px", color: "#6b7280" }}>
            {course.department}
          </span>
        )}
      </div>
      <span
        style={{
          flexShrink: 0,
          marginLeft: "8px",
          padding: "3px 8px",
          fontSize: "11px",
          fontWeight: 600,
          backgroundColor: badge.bg,
          color: badge.text,
          borderRadius: "9999px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "160px",
        }}
      >
        {badge.label}
      </span>
    </Link>
  );
}

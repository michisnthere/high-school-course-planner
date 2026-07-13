import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { formatCreditType } from "@/lib/catalog";
import { SaveCourseButton } from "./SaveCourseButton";

type CourseDetailHeaderProps = {
  course: Course;
  returnUrl?: string;
};

export function CourseDetailHeader({ course, returnUrl }: CourseDetailHeaderProps): React.ReactElement {
  const creditType = course.options?.[0]?.creditType ?? null;
  const division = course.department?.division?.name;
  const department = course.department?.name;
  const showDepartment = department && division && department.trim().toLowerCase() !== division.trim().toLowerCase();

  const backHref = returnUrl && returnUrl.startsWith("/") ? returnUrl : "/catalog";
  let backLabel = "← Back to Catalog";
  if (returnUrl === "/") {
    backLabel = "← Back to Dashboard";
  } else if (returnUrl?.startsWith("/catalog/")) {
    backLabel = "← Back";
  } else if (returnUrl) {
    backLabel = "← Back";
  }

  return (
    <div
      style={{
        marginBottom: "32px",
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
      }}
    >
      <Link
        href={backHref}
        style={{
          display: "inline-block",
          marginBottom: "16px",
          fontSize: "14px",
          color: "#d1d5db",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        {backLabel}
      </Link>

      <h1
        style={{
          margin: "0 0 12px",
          fontSize: "32px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
        }}
      >
        {course.title}
      </h1>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
        }}
      >
        {showDepartment && (
          <span
            style={{
              padding: "6px 12px",
              backgroundColor: "var(--bg-input)",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-secondary)",
            }}
          >
            {department}
          </span>
        )}

        {division && (
          <span
            style={{
              padding: "6px 12px",
              backgroundColor: "var(--bg-input)",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-secondary)",
            }}
          >
            {division}
          </span>
        )}

        {creditType && (
          <span
            style={{
              padding: "6px 12px",
              backgroundColor: "color-mix(in srgb, var(--brand-primary) 20%, transparent)",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--brand-primary-light)",
            }}
          >
            {formatCreditType(creditType)}
          </span>
        )}

        <SaveCourseButton course={course} />
      </div>
    </div>
  );
}

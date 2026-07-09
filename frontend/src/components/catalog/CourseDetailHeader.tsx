import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";

type CourseDetailHeaderProps = {
  course: Course;
};

export function CourseDetailHeader({ course }: CourseDetailHeaderProps): React.ReactElement {
  const creditType = course.options?.[0]?.creditType ?? null;
  const division = course.department?.division?.name;
  const department = course.department?.name;

  return (
    <div
      style={{
        marginBottom: "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <Link
        href="/catalog"
        style={{
          display: "inline-block",
          marginBottom: "16px",
          fontSize: "14px",
          color: "#6b7280",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        ← Back to Catalog
      </Link>

      <h1
        style={{
          margin: "0 0 12px",
          fontSize: "32px",
          fontWeight: 700,
          color: "#111827",
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
        {department && (
          <span
            style={{
              padding: "6px 12px",
              backgroundColor: "#f3f4f6",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#374151",
            }}
          >
            {department}
          </span>
        )}

        {division && (
          <span
            style={{
              padding: "6px 12px",
              backgroundColor: "#f3f4f6",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#374151",
            }}
          >
            {division}
          </span>
        )}

        {creditType && (
          <span
            style={{
              padding: "6px 12px",
              backgroundColor: "#eff6ff",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#1d4ed8",
            }}
          >
            {creditType}
          </span>
        )}
      </div>
    </div>
  );
}

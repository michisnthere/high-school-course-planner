import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { SaveCourseButton } from "./SaveCourseButton";

type CourseDetailHeaderProps = {
  course: Course;
  returnUrl?: string;
};

export function CourseDetailHeader({ course, returnUrl }: CourseDetailHeaderProps): React.ReactElement {
  const creditType = course.options?.[0]?.creditType ?? null;
  const division = course.department?.division?.name;
  const department = course.department?.name;

  const backHref = returnUrl && returnUrl.startsWith("/") ? returnUrl : "/catalog";
  const backLabel = returnUrl ? "← Back to Planner" : "← Back to Catalog";

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

        <SaveCourseButton course={course} />
      </div>
    </div>
  );
}

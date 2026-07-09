"use client";

import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";

type CourseCardProps = {
  course: Course;
};

function truncateDescription(text: string | null | undefined, maxLength = 150): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function CourseCard({ course }: CourseCardProps): React.ReactElement {
  const creditType = course.options?.[0]?.creditType ?? null;
  const description = truncateDescription(course.description);
  const slug = getCourseSlug(course);

  return (
    <Link
      href={`/catalog/${slug}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "20px",
          transition: "border-color 0.2s ease",
          cursor: "pointer",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#d1d5db";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#e5e7eb";
        }}
      >
        <h3
          style={{
            margin: "0 0 10px",
            fontSize: "18px",
            fontWeight: 600,
            color: "#111827",
            lineHeight: 1.3,
          }}
        >
          {course.title}
        </h3>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "12px",
            fontSize: "14px",
            color: "#6b7280",
          }}
        >
          {course.department?.name && (
            <span
              style={{
                padding: "4px 10px",
                backgroundColor: "#f3f4f6",
                borderRadius: "9999px",
                fontWeight: 500,
              }}
            >
              {course.department.name}
            </span>
          )}

          {creditType && (
            <span
              style={{
                padding: "4px 10px",
                backgroundColor: "#f3f4f6",
                borderRadius: "9999px",
                fontWeight: 500,
              }}
            >
              {creditType}
            </span>
          )}
        </div>

        {description && (
          <p
            style={{
              margin: 0,
              fontSize: "15px",
              color: "#374151",
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
      </div>
    </Link>
  );
}

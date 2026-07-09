"use client";

import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";
import { useSavedCourses } from "@/hooks/useSavedCourses";

type SavedCoursesContentProps = {
  courses: Course[];
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "20px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: "18px",
  fontWeight: 600,
  color: "#111827",
  lineHeight: 1.3,
  textDecoration: "none",
};

const badgeStyle: React.CSSProperties = {
  padding: "4px 10px",
  backgroundColor: "#f3f4f6",
  borderRadius: "9999px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#374151",
};

const viewLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: "36px",
  padding: "0 16px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#374151",
  backgroundColor: "#f3f4f6",
  borderRadius: "8px",
  textDecoration: "none",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const removeButtonStyle: React.CSSProperties = {
  height: "36px",
  padding: "0 16px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#dc2626",
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

export function SavedCoursesContent({ courses }: SavedCoursesContentProps): React.ReactElement {
  const { saved, toggle } = useSavedCourses();

  const savedCourses = courses.filter((course) =>
    saved.includes(getCourseSlug(course))
  );

  if (savedCourses.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: "16px",
          color: "#d1d5db",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        No saved courses yet.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "24px",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
      }}
    >
      {savedCourses.map((course) => {
        const slug = getCourseSlug(course);
        const creditType = course.options?.[0]?.creditType ?? null;

        return (
          <div key={slug} style={cardStyle}>
            <Link href={`/catalog/${slug}`} style={{ textDecoration: "none" }}>
              <h3 style={titleStyle}>{course.title}</h3>
            </Link>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              {course.department?.name && (
                <span style={badgeStyle}>{course.department.name}</span>
              )}
              {creditType && <span style={badgeStyle}>{creditType}</span>}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <Link href={`/catalog/${slug}`} style={viewLinkStyle}>
                View Course
              </Link>
              <button
                type="button"
                onClick={() => toggle(slug)}
                style={removeButtonStyle}
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";
import { formatCreditType } from "@/lib/catalog";
import { useSavedCourses } from "@/hooks/useSavedCourses";

type SavedCoursesContentProps = {
  courses: Course[];
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  padding: "20px",
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: "18px",
  fontWeight: 700,
  color: "var(--text-primary)",
  lineHeight: 1.3,
  textDecoration: "none",
};

const badgeStyle: React.CSSProperties = {
  padding: "4px 10px",
  backgroundColor: "var(--brand-accent-light)",
  borderRadius: "9999px",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

const viewLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: "36px",
  padding: "0 16px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#FFFFFF",
  backgroundColor: "var(--brand-accent)",
  borderRadius: "8px",
  textDecoration: "none",
};

const removeButtonStyle: React.CSSProperties = {
  height: "36px",
  padding: "0 16px",
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--btn-danger-text)",
  backgroundColor: "transparent",
  border: "1px solid var(--btn-danger-border)",
  borderRadius: "8px",
  cursor: "pointer",
};

const signInButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: "40px",
  padding: "0 20px",
  fontSize: "15px",
  fontWeight: 500,
  color: "#FFFFFF",
  backgroundColor: "var(--brand-accent)",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  textDecoration: "none",
};

export function SavedCoursesContent({
  courses,
}: SavedCoursesContentProps): React.ReactElement {
  const { savedIds, loading, isAuthenticated, toggle } = useSavedCourses();

  const savedCourses = courses.filter((course) => savedIds.includes(course.id));

  if (!isAuthenticated) {
    return (
      <div
        style={{
          padding: "24px",
          backgroundColor: "var(--bg-card)",
          borderRadius: "12px",
        }}
      >
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Sign in to save courses
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "15px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Your saved courses will be stored securely and synced across devices.
        </p>
        <a href="/login" style={signInButtonStyle}>
          Sign In
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: "16px",
          color: "var(--text-muted)",
        }}
      >
        Loading saved courses...
      </p>
    );
  }

  if (savedCourses.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: "16px",
          color: "var(--text-muted)",
        }}
      >
        No saved courses yet.
      </p>
    );
  }

  return (
    <div
      className="rs-saved-grid"
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
              {creditType && <span style={badgeStyle}>{formatCreditType(creditType)}</span>}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <Link href={`/catalog/${slug}`} style={viewLinkStyle}>
                View Course
              </Link>
              <button
                type="button"
                onClick={() => toggle(course.id)}
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

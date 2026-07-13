"use client";

import React from "react";
import type { Course } from "@/types/course";
import { useSavedCourses } from "@/hooks/useSavedCourses";

type SaveCourseButtonProps = {
  course: Course;
};

export function SaveCourseButton({
  course,
}: SaveCourseButtonProps): React.ReactElement {
  const { isSaved, toggle, isAuthenticated } = useSavedCourses();
  const saved = isSaved(course.id);

  const handleClick = () => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }
    toggle(course.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      style={{
        height: "36px",
        padding: "0 16px",
        fontSize: "14px",
        fontWeight: 600,
        color: saved ? "var(--btn-primary-text)" : "var(--text-secondary)",
        backgroundColor: saved ? "var(--brand-primary)" : "transparent",
        border: `1px solid ${saved ? "var(--brand-primary)" : "var(--btn-secondary-border)"}`,
        borderRadius: "8px",
        cursor: "pointer",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {saved ? "Saved" : "Save Course"}
    </button>
  );
}

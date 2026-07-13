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
        fontWeight: 500,
        color: saved ? "#FFFFFF" : "var(--text-secondary)",
        backgroundColor: saved ? "var(--brand-accent)" : "transparent",
        border: `1px solid ${saved ? "var(--brand-accent)" : "var(--btn-secondary-border)"}`,
        borderRadius: "8px",
        cursor: "pointer",

      }}
    >
      {saved ? "Saved" : "Save Course"}
    </button>
  );
}

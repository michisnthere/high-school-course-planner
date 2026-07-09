"use client";

import React from "react";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";
import { useSavedCourses } from "@/hooks/useSavedCourses";

type SaveCourseButtonProps = {
  course: Course;
};

export function SaveCourseButton({ course }: SaveCourseButtonProps): React.ReactElement {
  const slug = getCourseSlug(course);
  const { isSaved, toggle } = useSavedCourses();
  const saved = isSaved(slug);

  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={saved}
      style={{
        height: "36px",
        padding: "0 16px",
        fontSize: "14px",
        fontWeight: 600,
        color: saved ? "#ffffff" : "#374151",
        backgroundColor: saved ? "#2563eb" : "#ffffff",
        border: `1px solid ${saved ? "#2563eb" : "#e5e7eb"}`,
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

import React from "react";
import type { Course } from "@/types/course";

type CourseDescriptionProps = {
  course: Course;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function CourseDescription({ course }: CourseDescriptionProps): React.ReactElement {
  const notes = toStringArray(course.notes);
  const hasContent = Boolean(course.description) || notes.length > 0;

  if (!hasContent) {
    return (
      <div
        style={{
          padding: "24px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "12px",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "var(--text-muted)",
          }}
        >
          No description available.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
        marginBottom: "24px",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        Description
      </h2>

      {course.description && (
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "16px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          {course.description}
        </p>
      )}

      {notes.length > 0 && (
        <div>
          <h3
            style={{
              margin: "0 0 10px",
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Notes
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "15px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {notes.map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

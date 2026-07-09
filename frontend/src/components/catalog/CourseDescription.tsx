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
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          marginBottom: "24px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "#6b7280",
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
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        marginBottom: "24px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "20px",
          fontWeight: 600,
          color: "#111827",
        }}
      >
        Description
      </h2>

      {course.description && (
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "16px",
            color: "#374151",
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
              fontWeight: 600,
              color: "#111827",
            }}
          >
            Notes
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "15px",
              color: "#374151",
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

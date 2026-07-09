import React from "react";
import type { Course } from "@/types/course";

type CourseAttributesProps = {
  course: Course;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function TagList({ title, items }: { title: string; items: string[] }): React.ReactElement | null {
  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: "16px" }}>
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: "16px",
          fontWeight: 600,
          color: "#111827",
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            style={{
              padding: "6px 12px",
              backgroundColor: "#f3f4f6",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#374151",
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CourseAttributes({ course }: CourseAttributesProps): React.ReactElement | null {
  const graduationRequirements = toStringArray(course.fulfillsRequirements);
  const attributes = toStringArray(course.attributes);

  if (graduationRequirements.length === 0 && attributes.length === 0) {
    return null;
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
        Attributes
      </h2>

      <TagList title="Graduation Requirements" items={graduationRequirements} />
      <TagList title="Attributes" items={attributes} />
    </div>
  );
}

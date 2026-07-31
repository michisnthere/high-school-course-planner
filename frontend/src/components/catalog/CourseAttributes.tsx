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
          fontWeight: 700,
          color: "var(--text-primary)",
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
              backgroundColor: "var(--brand-accent-light)",
              borderRadius: "9999px",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
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
        Fulfills
      </h2>

      <TagList title="Graduation Requirements" items={graduationRequirements} />
      <TagList title="Attributes" items={attributes} />
    </div>
  );
}

import React from "react";
import type { Course } from "@/types/course";

type CoursePrerequisitesProps = {
  course: Course;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function collectItems(course: Course, field: "prerequisites" | "corequisites"): string[] {
  const items = new Set<string>();
  for (const option of course.options ?? []) {
    for (const offering of option.offerings ?? []) {
      for (const item of toStringArray(offering[field])) {
        if (item.trim()) {
          items.add(item.trim());
        }
      }
    }
  }
  return Array.from(items);
}

function ListSection({ title, items }: { title: string; items: string[] }): React.ReactElement | null {
  return (
    <div style={{ marginBottom: "16px" }}>
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: "16px",
          fontWeight: 600,
          color: "#111827",
        }}
      >
        {title}
      </h3>
      {items.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "#6b7280",
          }}
        >
          None
        </p>
      ) : (
        <ul
          style={{
            margin: 0,
            paddingLeft: "20px",
            fontSize: "15px",
            color: "#374151",
            lineHeight: 1.6,
          }}
        >
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CoursePrerequisites({ course }: CoursePrerequisitesProps): React.ReactElement {
  const prerequisites = collectItems(course, "prerequisites");
  const corequisites = collectItems(course, "corequisites");

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
        Requirements
      </h2>

      <ListSection title="Prerequisites" items={prerequisites} />
      <ListSection title="Corequisites" items={corequisites} />
    </div>
  );
}

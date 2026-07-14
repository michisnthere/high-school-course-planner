import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";
import { formatPrerequisiteForDisplay } from "@/lib/catalog";

type CoursePrerequisitesProps = {
  course: Course;
  allCourses: Course[];
};

type PrereqPart = {
  text: string;
  matchedCourse: Course | null;
};

type PrereqGroup = {
  parts: PrereqPart[];
  connector: "and" | "or" | null;
};

function findCourseByTitle(courses: Course[], title: string): Course | null {
  const normal = title.trim().toLowerCase();
  for (const course of courses) {
    if (course.title.toLowerCase() === normal) return course;
    if (course.normalizedTitle?.toLowerCase() === normal) return course;
  }
  for (const course of courses) {
    if (course.title.toLowerCase().includes(normal) || normal.includes(course.title.toLowerCase())) {
      return course;
    }
  }
  if (
    (normal === "a foundational fitness class" || normal === "a foundational fitness course") &&
    !normal.includes("any previous")
  ) {
    const ffCourse = courses.find((c) =>
      c.title.toLowerCase().includes("foundational fitness")
    );
    if (ffCourse) return ffCourse;
  }
  return null;
}

function collectPrereqStrings(course: Course): string[] {
  const items = new Set<string>();
  for (const option of course.options ?? []) {
    for (const offering of option.offerings ?? []) {
      for (const item of offering.prerequisites ?? []) {
        if (typeof item === "string" && item.trim()) {
          const trimmed = item.trim();
          const lower = trimmed.toLowerCase();
          if (lower !== "none" && lower !== "n/a") {
            items.add(trimmed);
          }
        }
      }
    }
  }
  return Array.from(items);
}

function parsePrereqGroups(prereqStrings: string[], courses: Course[]): PrereqGroup[] {
  return prereqStrings.map((text) => {
    const orParts = text.split(/\s+OR\s+/i).map((s) => s.trim()).filter(Boolean);
    if (orParts.length > 1) {
      return {
        connector: "or" as const,
        parts: orParts.map((part) => ({
          text: part,
          matchedCourse: findCourseByTitle(courses, part),
        })),
      };
    }

    const andParts = text.split(/\s+AND\s+/i).map((s) => s.trim()).filter(Boolean);
    if (andParts.length > 1) {
      return {
        connector: "and" as const,
        parts: andParts.map((part) => ({
          text: part,
          matchedCourse: findCourseByTitle(courses, part),
        })),
      };
    }

    return {
      connector: null,
      parts: [{ text, matchedCourse: findCourseByTitle(courses, text) }],
    };
  });
}

function PrereqChip({
  part,
  returnUrl,
}: {
  part: PrereqPart;
  returnUrl: string;
}): React.ReactElement {
  const displayText = formatPrerequisiteForDisplay(part.text);
  if (!part.matchedCourse) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "6px 14px",
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--text-secondary)",
          backgroundColor: "var(--bg-input)",
          borderRadius: "8px",
        }}
      >
        {displayText}
      </span>
    );
  }

  const slug = getCourseSlug(part.matchedCourse);
  return (
    <Link
      href={`/catalog/${slug}?return=${encodeURIComponent(returnUrl)}`}
      style={{ textDecoration: "none" }}
    >
      <span
        className="prereq-chip"
        style={{
          display: "inline-block",
          padding: "6px 14px",
          fontSize: "14px",
          fontWeight: 600,
          color: "#ffffff",
          backgroundColor: "var(--brand-accent)",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        {displayText}
      </span>
    </Link>
  );
}

export function CoursePrerequisites({ course, allCourses }: CoursePrerequisitesProps): React.ReactElement {
  const prereqStrings = collectPrereqStrings(course);
  const groups = parsePrereqGroups(prereqStrings, allCourses);

  const currentSlug = getCourseSlug(course);
  const returnUrl = `/catalog/${currentSlug}`;

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
        Prerequisites
      </h2>

      <style>{`
        .prereq-chip:hover {
          background-color: var(--brand-accent-hover) !important;
        }
      `}</style>

      {groups.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "var(--text-muted)",
          }}
        >
          No prerequisites.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {groups.map((group, gi) => (
            <div
              key={gi}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {group.parts.map((part, pi) => (
                <React.Fragment key={pi}>
                  {pi > 0 && group.connector && (
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {group.connector}
                    </span>
                  )}
                  <PrereqChip part={part} returnUrl={returnUrl} />
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";
import { getCoursesRequiringPrerequisite } from "@/lib/catalog";

type CourseRequiredForProps = {
  course: Course;
  allCourses: Course[];
};

export function CourseRequiredFor({ course, allCourses }: CourseRequiredForProps): React.ReactElement {
  const dependents = getCoursesRequiringPrerequisite(course, allCourses);

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
        Required For
      </h2>

      {dependents.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "var(--text-muted)",
          }}
        >
          No courses currently require this course as a prerequisite.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            overflowWrap: "anywhere",
          }}
        >
          {dependents.map((dependent) => {
            const slug = getCourseSlug(dependent);
            return (
              <Link
                key={dependent.id}
                href={`/catalog/${slug}?return=${encodeURIComponent(returnUrl)}`}
                style={{ textDecoration: "none" }}
              >
                <span
                  className="required-for-chip"
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#ffffff",
                    backgroundColor: "var(--brand-accent)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    maxWidth: "100%",
                    overflowWrap: "break-word",
                  }}
                >
                  {dependent.title}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .required-for-chip:hover {
          background-color: var(--brand-accent-hover) !important;
        }
      `}</style>
    </div>
  );
}
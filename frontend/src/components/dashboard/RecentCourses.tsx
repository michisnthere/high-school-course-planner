import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { formatCreditType } from "@/lib/catalog";
import { getCourseSlug } from "@/lib/normalize";

type RecentCoursesProps = {
  courses: Course[];
  limit?: number;
};

export function RecentCourses({
  courses,
  limit = 5,
}: RecentCoursesProps): React.ReactElement {
  const preview = courses.slice(0, limit);

  return (
    <div
      style={{
        flex: 1,
        minWidth: "280px",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
        padding: "20px",
        backgroundColor: "var(--bg-card)",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "18px",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        Recent Courses
      </h2>

      {preview.length === 0 ? (
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "14px",
          }}
        >
          No courses available.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {preview.map((course, index) => {
            const slug = getCourseSlug(course);
            return (
              <li
                key={`${course.title}-${index}`}
                style={{
                  padding: "12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-input)",
                }}
              >
                <Link
                  href={`/catalog/${slug}?return=/`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {course.title}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginTop: "4px",
                      fontSize: "13px",
                      color: "var(--text-muted)",
                    }}
                  >
                    {course.department?.name && (
                      <span>{course.department.name}</span>
                    )}
                    {course.options?.[0]?.creditType && (
                      <span>• {formatCreditType(course.options[0].creditType)}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import React from "react";
import type { Course } from "@/types/course";
import { formatCreditType } from "@/lib/catalog";

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
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "20px",
        backgroundColor: "#ffffff",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "18px",
          fontWeight: 600,
          color: "#111827",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Explore Courses
      </h2>

      {preview.length === 0 ? (
        <p
          style={{
            color: "#6b7280",
            fontSize: "14px",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
          {preview.map((course, index) => (
            <li
              key={`${course.title}-${index}`}
              style={{
                padding: "12px",
                border: "1px solid #f3f4f6",
                borderRadius: "8px",
                backgroundColor: "#f9fafb",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#111827",
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
                  color: "#6b7280",
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
              {course.department?.name && (
                <span>{course.department.name}</span>
              )}

              {course.options?.[0]?.creditType && (
                <span>• {formatCreditType(course.options[0].creditType)}</span>
              )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

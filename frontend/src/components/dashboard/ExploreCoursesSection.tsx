import React from "react";
import Link from "next/link";
import type { Course } from "@/types/course";
import { formatCreditType } from "@/lib/catalog";
import { getCourseSlug } from "@/lib/normalize";

type ExploreCoursesSectionProps = {
  courses: Course[];
  limit?: number;
};

export function ExploreCoursesSection({
  courses,
  limit = 8,
}: ExploreCoursesSectionProps): React.ReactElement {
  const preview = courses.slice(0, limit);

  return (
    <div
      style={{
        flex: 1,
        minWidth: "300px",
        padding: "24px",
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
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
        Explore Courses
      </h2>

      <style>{`
        .explore-course-card:hover {
          background-color: #f3f4f6 !important;
        }
      `}</style>

      {preview.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "#6b7280",
          }}
        >
          No courses available.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {preview.map((course) => {
            const slug = getCourseSlug(course);
            return (
              <Link
                key={course.id}
                href={`/catalog/${slug}?return=/`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  className="explore-course-card"
                  style={{
                    padding: "12px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "#111827",
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
                    }}
                  >
                    {course.department?.name && (
                      <span>{course.department.name}</span>
                    )}
                    {course.options?.[0]?.creditType && (
                      <span>
                        • {formatCreditType(course.options[0].creditType)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

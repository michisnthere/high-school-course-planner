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
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "20px",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        Explore Courses
      </h2>

      <style>{`
        .explore-course-card:hover {
          background-color: var(--bg-card-hover) !important;
        }
      `}</style>

      {preview.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "var(--text-muted)",
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
                    backgroundColor: "var(--bg-input)",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "15px",
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

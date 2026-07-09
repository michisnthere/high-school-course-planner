import React from "react";
import type { Course, CourseOffering } from "@/types/course";

type CourseOfferingsProps = {
  course: Course;
};

function collectOfferings(course: Course): CourseOffering[] {
  return (course.options ?? []).flatMap((option) => option.offerings ?? []);
}

function formatGradeLevels(gradeMin?: number | null, gradeMax?: number | null): string | null {
  if (gradeMin != null && gradeMax != null) {
    if (gradeMin === gradeMax) return `Grade ${gradeMin}`;
    return `Grades ${gradeMin}-${gradeMax}`;
  }
  if (gradeMin != null) return `Grade ${gradeMin}`;
  if (gradeMax != null) return `Grade ${gradeMax}`;
  return null;
}

export function CourseOfferings({ course }: CourseOfferingsProps): React.ReactElement {
  const offerings = collectOfferings(course);

  if (offerings.length === 0) {
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
            margin: "0 0 12px",
            fontSize: "20px",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          Offerings
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "#6b7280",
          }}
        >
          No offerings available.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
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
        Offerings
      </h2>

      <div
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {offerings.map((offering, index) => {
          const gradeLevels = formatGradeLevels(offering.gradeMin, offering.gradeMax);

          return (
            <div
              key={`${offering.courseCode}-${index}`}
              style={{
                padding: "20px",
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {offering.courseCode}
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "14px",
                  color: "#6b7280",
                }}
              >
                {offering.semesterLabel && <span>Semester: {offering.semesterLabel}</span>}
                {offering.duration && <span>Duration: {offering.duration}</span>}
                {gradeLevels && <span>{gradeLevels}</span>}
                {offering.credits != null && <span>Credits: {offering.credits}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

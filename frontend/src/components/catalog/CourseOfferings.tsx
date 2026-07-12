import React from "react";
import type { Course } from "@/types/course";

type CourseAdditionalInfoProps = {
  course: Course;
};

function getGradeLevels(course: Course): string | null {
  let gMin: number | null = null;
  let gMax: number | null = null;
  for (const option of course.options ?? []) {
    for (const offering of option.offerings ?? []) {
      if (offering.gradeMin != null && (gMin == null || offering.gradeMin < gMin)) {
        gMin = offering.gradeMin;
      }
      if (offering.gradeMax != null && (gMax == null || offering.gradeMax > gMax)) {
        gMax = offering.gradeMax;
      }
    }
  }
  if (gMin == null && gMax == null) return null;
  if (gMin != null && gMax != null) {
    if (gMin === gMax) return `Grade ${gMin}`;
    return `${gMin}\u2013${gMax}`;
  }
  return `Grade ${gMin ?? gMax}`;
}

function getDuration(course: Course): string | null {
  for (const option of course.options ?? []) {
    for (const offering of option.offerings ?? []) {
      if (offering.duration) return offering.duration;
    }
  }
  return course.duration != null ? `${course.duration} years` : null;
}

function getCredits(course: Course): number | null {
  for (const option of course.options ?? []) {
    if (option.credits != null) return option.credits;
    for (const offering of option.offerings ?? []) {
      if (offering.credits != null) return offering.credits;
    }
  }
  return null;
}

function groupOfferingsBySemester(course: Course): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const option of course.options ?? []) {
    for (const offering of option.offerings ?? []) {
      const semester = offering.semesterLabel || "Other";
      if (!groups.has(semester)) groups.set(semester, []);
      groups.get(semester)!.push(offering.courseCode);
    }
  }
  return groups;
}

export function CourseOfferings({ course }: CourseAdditionalInfoProps): React.ReactElement {
  const gradeLevels = getGradeLevels(course);
  const duration = getDuration(course);
  const credits = getCredits(course);
  const semesterGroups = groupOfferingsBySemester(course);

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
        Additional Information
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px 24px",
          fontSize: "15px",
        }}
      >
        {gradeLevels && (
          <>
            <div style={{ color: "#6b7280", fontWeight: 500 }}>Grades</div>
            <div style={{ color: "#111827", fontWeight: 600 }}>{gradeLevels}</div>
          </>
        )}

        {duration && (
          <>
            <div style={{ color: "#6b7280", fontWeight: 500 }}>Duration</div>
            <div style={{ color: "#111827", fontWeight: 600 }}>{duration}</div>
          </>
        )}

        {credits != null && (
          <>
            <div style={{ color: "#6b7280", fontWeight: 500 }}>Credits</div>
            <div style={{ color: "#111827", fontWeight: 600 }}>{credits}</div>
          </>
        )}

        {semesterGroups.size > 0 && (
          <>
            <div
              style={{
                color: "#6b7280",
                fontWeight: 500,
                gridColumn: "1 / -1",
                marginTop: "8px",
                borderTop: "1px solid #f3f4f6",
                paddingTop: "12px",
              }}
            >
              Course Codes
            </div>
            {Array.from(semesterGroups.entries()).map(([semester, codes]) => (
              <React.Fragment key={semester}>
                <div style={{ color: "#6b7280", fontWeight: 500 }}>{semester}</div>
                <div style={{ color: "#111827", fontWeight: 600 }}>
                  {codes.join(", ")}
                </div>
              </React.Fragment>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

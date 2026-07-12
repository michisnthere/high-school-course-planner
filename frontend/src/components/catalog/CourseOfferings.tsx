import React from "react";
import type { Course } from "@/types/course";
import { formatSemesterLabel } from "@/lib/catalog";

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

function getNormalizedDuration(course: Course): number | null {
  for (const option of course.options ?? []) {
    for (const offering of option.offerings ?? []) {
      if (offering.duration != null) {
        const n = parseFloat(offering.duration);
        if (!isNaN(n)) return n;
      }
    }
  }
  if (course.duration != null) return course.duration;
  return null;
}

function formatDuration(raw: number | null): string | null {
  if (raw == null) return null;
  if (raw === 1) return "One Semester";
  if (raw === 2) return "Full Year";
  return `${raw} Semesters`;
}

function totalCredits(duration: number | null): number | null {
  if (duration == null) return null;
  if (duration === 1) return 1;
  if (duration === 2) return 2;
  return null;
}

function isMathCourse(course: Course): boolean {
  const name = course.department?.name?.toLowerCase() ?? "";
  return name.includes("math");
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
  const rawDuration = getNormalizedDuration(course);
  const durationLabel = formatDuration(rawDuration);
  const creditsRaw = totalCredits(rawDuration);
  const semesterGroups = groupOfferingsBySemester(course);
  const showMathNote = gradeLevels != null && isMathCourse(course);

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
            <div style={{ color: "#111827", fontWeight: 600 }}>
              {gradeLevels}
              {showMathNote && (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "13px",
                    color: "#6b7280",
                    fontWeight: 400,
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}
                >
                  Students who complete the prerequisite course earlier may enroll
                  in this course in an earlier grade.
                </p>
              )}
            </div>
          </>
        )}

        {durationLabel && (
          <>
            <div style={{ color: "#6b7280", fontWeight: 500 }}>Duration</div>
            <div style={{ color: "#111827", fontWeight: 600 }}>{durationLabel}</div>
          </>
        )}

        {creditsRaw != null && (
          <>
            <div style={{ color: "#6b7280", fontWeight: 500 }}>Total Credits</div>
            <div style={{ color: "#111827", fontWeight: 600 }}>{creditsRaw}</div>
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
                <div style={{ color: "#6b7280", fontWeight: 500 }}>{formatSemesterLabel(semester)}</div>
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

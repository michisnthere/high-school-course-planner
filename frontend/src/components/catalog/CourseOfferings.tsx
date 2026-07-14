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

function totalCredits(course: Course): number | null {
  for (const option of course.options ?? []) {
    if (option.credits != null) {
      const semCount = getNormalizedDuration(course) === 2 ? 2 : 1;
      return option.credits * semCount;
    }
    for (const offering of option.offerings ?? []) {
      if (offering.credits != null) return offering.credits;
    }
  }
  const raw = getNormalizedDuration(course);
  if (raw == null) return null;
  return raw === 2 ? 2 : 1;
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
  const creditsRaw = totalCredits(course);
  const semesterGroups = groupOfferingsBySemester(course);
  const showMathNote = gradeLevels != null && isMathCourse(course);

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
            <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>Grades</div>
            <div style={{ color: "var(--text-primary)", fontWeight: 400 }}>
              {gradeLevels}
              {showMathNote && (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "13px",
                    color: "var(--text-muted)",
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
            <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>Duration</div>
            <div style={{ color: "var(--text-primary)", fontWeight: 400 }}>{durationLabel}</div>
          </>
        )}

        {creditsRaw != null && (
          <>
            <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>Total Credits</div>
            <div style={{ color: "var(--text-primary)", fontWeight: 400 }}>{creditsRaw}</div>
          </>
        )}

        {semesterGroups.size > 0 && (
          <>
            <div
              style={{
                color: "var(--text-muted)",
                  fontWeight: 600,
                  gridColumn: "1 / -1",
                marginTop: "8px",
                borderTop: "1px solid var(--border-default)",
                paddingTop: "12px",
              }}
            >
              Course Codes
            </div>
            {Array.from(semesterGroups.entries()).map(([semester, codes]) => (
              <React.Fragment key={semester}>
                <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>{formatSemesterLabel(semester)}</div>
                <div style={{ color: "var(--text-primary)", fontWeight: 400 }}>
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

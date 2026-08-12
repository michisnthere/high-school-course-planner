"use client";

import React from "react";
import Link from "next/link";
import type { Planner } from "@/lib/planner";
import { breakpoints } from "@/lib/responsive";
import { formatCredits } from "@/lib/courseCredits";
import { calculatePlannerOccupancy } from "@/lib/plannerOccupancy";
import {
  SUMMER_SEMESTER,
  SUMMER_SEMESTER_2,
  ONLINE_SEMESTER,
  ONLINE_SEMESTER_2,
  isSummerSemester,
  isOnlineSemester,
} from "@/lib/plannerSemesters";

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

type YearAnalysisItem = {
  category: string;
  met: boolean;
  earnedCredits: number;
  requiredCredits: number;
};

type YearOverviewCardProps = {
  planner: Planner;
  yearAnalysis?: {
    satisfiedCount: number;
    totalCount: number;
    items: YearAnalysisItem[];
  };
  onMarkCompleted?: (planner: Planner) => void;
  markingCompleted?: boolean;
  onMarkActive?: (planner: Planner) => void;
  markingActive?: boolean;
};

export function YearOverviewCard({
  planner,
  yearAnalysis,
  onMarkCompleted,
  markingCompleted = false,
  onMarkActive,
  markingActive = false,
}: YearOverviewCardProps): React.ReactElement {
  const label = YEAR_LABELS[planner.schoolYear] ?? `Year ${planner.schoolYear}`;

  const sem1Courses = planner.plannedCourses
    .filter((pc) => pc.semester === 1)
    .sort((a, b) => a.slot - b.slot);

  const sem2Courses = planner.plannedCourses
    .filter((pc) => pc.semester === 2)
    .sort((a, b) => a.slot - b.slot);

  const semSummerCourses = planner.plannedCourses
    .filter((pc) => pc.semester === SUMMER_SEMESTER)
    .sort((a, b) => a.slot - b.slot);

  const semSummer2Courses = planner.plannedCourses
    .filter((pc) => pc.semester === SUMMER_SEMESTER_2)
    .sort((a, b) => a.slot - b.slot);
  const summerCourses = [...semSummerCourses, ...semSummer2Courses].sort((a, b) => a.semester - b.semester || a.slot - b.slot);

  const semOnlineCourses = planner.plannedCourses
    .filter((pc) => pc.semester === ONLINE_SEMESTER)
    .sort((a, b) => a.slot - b.slot);

  const semOnline2Courses = planner.plannedCourses
    .filter((pc) => pc.semester === ONLINE_SEMESTER_2)
    .sort((a, b) => a.slot - b.slot);
  const onlineCourses = [...semOnlineCourses, ...semOnline2Courses].sort((a, b) => a.semester - b.semester || a.slot - b.slot);

  const occupancy = calculatePlannerOccupancy(planner);
  const filledSlots = occupancy.filledSlots;

  const isPlanned = planner.plannedCourses.length > 0;
  const isCompleted = planner.completedAt != null;
  const allMet = yearAnalysis ? yearAnalysis.satisfiedCount === yearAnalysis.totalCount : false;

  let badgeLabel: string;
  let badgeStyle: React.CSSProperties;

  if (isCompleted) {
    badgeLabel = "✓ Completed";
    badgeStyle = successBadge;
  } else if (!isPlanned) {
    badgeLabel = "Not Planned";
    badgeStyle = neutralBadge;
  } else if (allMet) {
    badgeLabel = "On Track";
    badgeStyle = successBadge;
  } else {
    badgeLabel = "Needs Attention";
    badgeStyle = warningBadge;
  }

  const missingItems = isPlanned && yearAnalysis
    ? yearAnalysis.items.filter((i) => i.requiredCredits > 0 && !i.met)
    : [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "24px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "16px",
        minWidth: 0,
        overflowWrap: "break-word",
      }}
    >
      <style>{`
        .yoc-header {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }
        .yoc-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          order: 2;
        }
        .yoc-badge-row {
          display: flex;
          align-items: center;
          order: 1;
          margin-left: auto;
        }
        @media (min-width: ${breakpoints.mobile}px) and (max-width: 1199px) {
          .yoc-badge-row {
            order: 2;
            margin-left: 0;
            flex-basis: 100%;
          }
          .yoc-header-actions {
            order: 1;
            margin-left: auto;
          }
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .yoc-header > h2 {
            flex-basis: 100%;
            flex-shrink: 0;
          }
          .yoc-badge-row {
            order: 1;
            margin-left: 0;
            flex-basis: auto;
          }
          .yoc-header-actions {
            order: 2;
            margin-left: 0;
          }
        }
      `}</style>

      {/* Header row */}
      <div className="yoc-header">
        <h2
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "visible",
            flexShrink: 0,
          }}
        >
          {label}
        </h2>
        <div className="yoc-header-actions">
          {isCompleted ? (
            <Link
              href={`/planner/${planner.schoolYear}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "44px",
                padding: "10px 20px",
                fontSize: "15px",
                fontWeight: 700,
                color: "#ffffff",
                backgroundColor: "var(--brand-accent)",
                textDecoration: "none",
                whiteSpace: "nowrap",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                gap: "4px",
              }}
            >
              View Planner →
            </Link>
          ) : (
            <Link
              href={`/planner/${planner.schoolYear}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "44px",
                padding: "10px 20px",
                fontSize: "15px",
                fontWeight: 700,
                color: "#ffffff",
                backgroundColor: "var(--brand-accent)",
                textDecoration: "none",
                whiteSpace: "nowrap",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                gap: "4px",
              }}
            >
              Edit Planner →
            </Link>
          )}
        </div>
        <div className="yoc-badge-row">
          {isCompleted ? (
            <span style={successBadge}>✓ Year Completed</span>
          ) : (
            <span style={badgeStyle}>{badgeLabel}</span>
          )}
        </div>
      </div>

      {/* Warnings */}
      {missingItems.length > 0 && !isCompleted && (
        <div
          style={{
            marginTop: "2px",
            marginBottom: "12px",
            padding: "20px",
            backgroundColor: "var(--warning-bg, #fef9c3)",
            borderRadius: "8px",
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--warning-text, #854d0e)",
            }}
          >
            Needs attention:
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {missingItems.map((item) => (
              <li
                key={item.category}
                style={{
                  fontSize: "13px",
                  color: "var(--warning-text, #854d0e)",
                  lineHeight: 1.4,
                }}
              >
                {item.requiredCredits > 1
                  ? `Missing ${item.category} (${formatCredits(item.earnedCredits)} / ${formatCredits(item.requiredCredits)} credits)`
                  : `Missing ${item.category}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Courses */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          flex: 1,
        }}
      >
        <SemesterBlock semester={1} courses={sem1Courses} />
        <SemesterBlock semester={2} courses={sem2Courses} />
        {summerCourses.length > 0 && <CourseListBlock label="Summer School" courses={summerCourses} nested />}
        {onlineCourses.length > 0 && <CourseListBlock label="Online" courses={onlineCourses} />}
      </div>

      {/* Course count */}
      <p
        style={{
          margin: "16px 0 0",
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--text-muted)",
        }}
      >
        {filledSlots} / {occupancy.totalSlots} courses planned
      </p>

      {isPlanned && !isCompleted && (
        <button
          type="button"
          onClick={() => onMarkCompleted?.(planner)}
          disabled={markingCompleted || !onMarkCompleted}
          style={{
            marginTop: "16px",
            minHeight: "44px",
            padding: "8px 14px",
            border: "1px solid #166534",
            borderRadius: "8px",
            backgroundColor: markingCompleted ? "#dcfce7" : "#166534",
            color: markingCompleted ? "#166534" : "#ffffff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: markingCompleted || !onMarkCompleted ? "default" : "pointer",
          }}
        >
          {markingCompleted ? "Marking..." : "Mark Year Completed"}
        </button>
      )}

      {isCompleted && (
        <button
          type="button"
          onClick={() => onMarkActive?.(planner)}
          disabled={markingActive || !onMarkActive}
          style={{
            marginTop: "16px",
            minHeight: "44px",
            padding: "8px 14px",
            border: "1px solid var(--border-default)",
            borderRadius: "8px",
            backgroundColor: markingActive ? "var(--bg-input)" : "transparent",
            color: markingActive ? "var(--text-muted)" : "var(--text-primary)",
            fontSize: "14px",
            fontWeight: 600,
            cursor: markingActive || !onMarkActive ? "default" : "pointer",
          }}
        >
          {markingActive ? "Restoring..." : "Mark as Active"}
        </button>
      )}
    </div>
  );
}

const baseBadge: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  padding: "4px 12px",
  borderRadius: "9999px",
  whiteSpace: "nowrap",
};

const successBadge: React.CSSProperties = {
  ...baseBadge,
  color: "#166534",
  backgroundColor: "#dcfce7",
};

const warningBadge: React.CSSProperties = {
  ...baseBadge,
  color: "#854d0e",
  backgroundColor: "#fef9c3",
};

const neutralBadge: React.CSSProperties = {
  ...baseBadge,
  color: "var(--text-muted)",
  backgroundColor: "var(--bg-input)",
};

function SemesterBlock({
  semester,
  courses,
}: {
  semester: number;
  courses: ({ slot: number; slotSpan?: number | null; course: { title: string; courseCode: string | null; courseCodeS1: string | null; courseCodeS2: string | null } })[];
}): React.ReactElement {
  const isOut = isSummerSemester(semester) || isOnlineSemester(semester);
  // Out-of-semester sections (Summer School / Online) have exactly ONE course
  // position per semester — never a 7-slot grid.
  const allSlots = isOut ? [1] : Array.from({ length: 7 }, (_, i) => i + 1);

  const findCourse = (slotNum: number) =>
    courses.find((c) => c.slot <= slotNum && slotNum < c.slot + (c.slotSpan ?? 1));

  return (
    <div>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {isSummerSemester(semester)
          ? `Summer School${semester === SUMMER_SEMESTER_2 ? " 2" : ""}`
          : isOnlineSemester(semester)
            ? `Online ${semester === ONLINE_SEMESTER_2 ? "2" : "1"}`
            : `Semester ${semester}`}
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {allSlots.map((slotNum) => {
          const course = findCourse(slotNum);
          return (
            <div
              key={slotNum}
              style={{
                padding: "8px 12px",
                fontSize: "14px",
                color: course ? "var(--text-primary)" : "var(--text-muted)",
                backgroundColor: course ? "var(--bg-input)" : "transparent",
                borderRadius: "6px",
                border: course ? "none" : "1px dashed var(--border-default)",
              }}
            >
              {course ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {(() => {
                    const code = semester === 1 ? course.course.courseCodeS1 : course.course.courseCodeS2;
                    return code ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {code}
                      </span>
                    ) : null;
                  })()}
                  <span style={{ lineHeight: 1.3, wordBreak: "break-word", overflowWrap: "break-word" }}>{course.course.title}</span>
                </div>
              ) : (
                "Empty"
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CourseListBlock({
  label,
  courses,
  nested = false,
}: {
  label: string;
  courses: ({ semester: number; slot: number; slotSpan?: number | null; course: { title: string; courseCode: string | null; courseCodeS1: string | null; courseCodeS2: string | null } })[];
  nested?: boolean;
}): React.ReactElement {
  return (
    <div style={{ marginLeft: nested ? "12px" : 0, paddingLeft: nested ? "12px" : 0, borderLeft: nested ? "2px solid var(--border-default)" : "none" }}>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {courses.map((plannedCourse) => {
          const code =
            plannedCourse.course.courseCode ??
            plannedCourse.course.courseCodeS1 ??
            plannedCourse.course.courseCodeS2;
          return (
            <div
              key={`${plannedCourse.semester}-${plannedCourse.slot}-${plannedCourse.course.title}`}
              style={{
                padding: "8px 12px",
                fontSize: "14px",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-input)",
                borderRadius: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {code ? (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {code}
                  </span>
                ) : null}
                <span style={{ lineHeight: 1.3, wordBreak: "break-word", overflowWrap: "break-word" }}>
                  {plannedCourse.course.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

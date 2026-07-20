"use client";

import React from "react";
import Link from "next/link";
import type { Planner } from "@/lib/planner";
import { breakpoints } from "@/lib/responsive";

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

const TOTAL_SLOTS = 14;

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
};

function Estyle(el: HTMLElement, prop: string, val: string) {
  el.style[prop as any] = val;
}

export function YearOverviewCard({ planner, yearAnalysis }: YearOverviewCardProps): React.ReactElement {
  const label = YEAR_LABELS[planner.schoolYear] ?? `Year ${planner.schoolYear}`;

  const sem1Courses = planner.plannedCourses
    .filter((pc) => pc.semester === 1)
    .sort((a, b) => a.slot - b.slot);

  const sem2Courses = planner.plannedCourses
    .filter((pc) => pc.semester === 2)
    .sort((a, b) => a.slot - b.slot);

  const filledSlots = planner.plannedCourses.length;

  const isPlanned = filledSlots > 0;
  const allMet = yearAnalysis ? yearAnalysis.satisfiedCount === yearAnalysis.totalCount : false;

  let badgeLabel: string;
  let badgeStyle: React.CSSProperties;

  if (!isPlanned) {
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
      }}
    >
      <style>{`
        .yoc-badge-desktop { display: block; }
        .yoc-badge-mobile { display: none; margin-bottom: 16px; }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .yoc-badge-desktop { display: none; }
          .yoc-badge-mobile { display: block; }
        }
      `}</style>

      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          {label}
        </h2>
        <span className="yoc-badge-desktop">
          <span style={badgeStyle}>{badgeLabel}</span>
        </span>
      </div>

      {/* Mobile badge */}
      <span className="yoc-badge-mobile">
        <span style={badgeStyle}>{badgeLabel}</span>
      </span>

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
        {filledSlots} / {TOTAL_SLOTS} courses planned
      </p>

      {/* Warnings */}
      {missingItems.length > 0 && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            backgroundColor: "var(--warning-bg, #fef9c3)",
            borderRadius: "8px",
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
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
              gap: "4px",
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
                  ? `Missing ${item.category} (${item.earnedCredits} / ${item.requiredCredits} credits)`
                  : `Missing ${item.category}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={`/planner/${planner.schoolYear}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "20px",
          padding: "12px",
          fontSize: "15px",
          fontWeight: 600,
          color: "#ffffff",
          backgroundColor: "var(--brand-accent)",
          borderRadius: "10px",
          textDecoration: "none",
          transition: "background-color 0.2s ease",
        }}
        onMouseEnter={(e) => { Estyle(e.currentTarget, "backgroundColor", "var(--brand-accent-hover)"); }}
        onMouseLeave={(e) => { Estyle(e.currentTarget, "backgroundColor", "var(--brand-accent)"); }}
      >
        Edit Planner →
      </Link>
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
  courses: { slot: number; course: { title: string } }[];
}): React.ReactElement {
  const filledSlots = new Set(courses.map((c) => c.slot));
  const allSlots = Array.from({ length: 7 }, (_, i) => i + 1);

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
        Semester {semester}
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {allSlots.map((slotNum) => {
          const course = courses.find((c) => c.slot === slotNum);
          return (
            <div
              key={slotNum}
              style={{
                padding: "6px 10px",
                fontSize: "14px",
                color: course ? "var(--text-primary)" : "var(--text-muted)",
                backgroundColor: course ? "var(--bg-input)" : "transparent",
                borderRadius: "6px",
                border: course ? "none" : "1px dashed var(--border-default)",
              }}
            >
              {course ? course.course.title : "Empty"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

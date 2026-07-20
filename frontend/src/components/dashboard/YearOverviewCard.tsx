"use client";

import React from "react";
import Link from "next/link";
import type { Planner } from "@/lib/planner";

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

const TOTAL_SLOTS = 14;

type YearOverviewCardProps = {
  planner: Planner;
};

export function YearOverviewCard({ planner }: YearOverviewCardProps): React.ReactElement {
  const label = YEAR_LABELS[planner.schoolYear] ?? `Year ${planner.schoolYear}`;

  const sem1Courses = planner.plannedCourses
    .filter((pc) => pc.semester === 1)
    .sort((a, b) => a.slot - b.slot);

  const sem2Courses = planner.plannedCourses
    .filter((pc) => pc.semester === 2)
    .sort((a, b) => a.slot - b.slot);

  const filledSlots = planner.plannedCourses.length;
  const slotCount = Math.max(filledSlots, sem1Courses.length + sem2Courses.length);

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
        <span
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--text-muted)",
            padding: "4px 12px",
            backgroundColor: "var(--bg-input)",
            borderRadius: "9999px",
          }}
        >
          {filledSlots} / {TOTAL_SLOTS} courses
        </span>
      </div>

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
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--brand-accent-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--brand-accent)";
        }}
      >
        Edit Planner →
      </Link>
    </div>
  );
}

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

"use client";

import React, { useEffect, useState } from "react";
import type { Course } from "@/types/course";
import type { DivisionGroup, DepartmentGroup } from "@/lib/catalog";
import { CourseCard } from "./CourseCard";

type CourseGridProps = {
  groupedCourses: DivisionGroup[];
};

function getColumnCount(width: number): number {
  if (width >= 1280) return 3;
  if (width >= 768) return 2;
  return 1;
}

function useColumnCount(): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const handleResize = () => setColumns(getColumnCount(window.innerWidth));

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return columns;
}

function CourseCards({ courses, columns }: { courses: Course[]; columns: number }): React.ReactElement {
  return (
    <div
      style={{
        display: "grid",
        gap: "24px",
        width: "100%",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {courses.map((course, index) => (
        <CourseCard key={`${course.title}-${index}`} course={course} />
      ))}
    </div>
  );
}

function DepartmentSection({
  group,
  columns,
  showHeader,
}: {
  group: DepartmentGroup;
  columns: number;
  showHeader: boolean;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {showHeader && (
        <h3
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: "#111827",
            lineHeight: 1.3,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          {group.department.name}
        </h3>
      )}
      <CourseCards courses={group.courses} columns={columns} />
    </div>
  );
}

function DivisionSection({
  group,
  columns,
}: {
  group: DivisionGroup;
  columns: number;
}): React.ReactElement {
  const isMultiDepartment = group.departments.length > 1;
  const [expanded, setExpanded] = useState(false);

  if (!isMultiDepartment) {
    const department = group.departments[0];
    if (!department) return <></>;
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.3,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          {department.department.name}
        </h2>
        <CourseCards courses={department.courses} columns={columns} />
      </section>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "16px 20px",
          fontSize: "20px",
          fontWeight: 700,
          color: "#111827",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          cursor: "pointer",
          textAlign: "left",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#d1d5db";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#e5e7eb";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <span>{group.division.name}</span>
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            color: "#2563eb",
            fontSize: "14px",
            transition: "transform 0.3s ease",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.3s ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              padding: "4px 4px 8px",
            }}
          >
            {group.departments.map((department) => (
              <DepartmentSection
                key={department.department.name}
                group={department}
                columns={columns}
                showHeader
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CourseGrid({ groupedCourses }: CourseGridProps): React.ReactElement {
  const columns = useColumnCount();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      {groupedCourses.map((group) => (
        <DivisionSection
          key={group.division.name}
          group={group}
          columns={columns}
        />
      ))}
    </div>
  );
}

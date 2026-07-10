"use client";

import React, { useEffect, useId, useState } from "react";
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

function Bubble({
  label,
  count,
  isSelected,
  onClick,
  accentColor,
}: {
  label: string;
  count?: number;
  isSelected?: boolean;
  onClick: () => void;
  accentColor?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 20px",
        fontSize: "15px",
        fontWeight: 600,
        color: isSelected ? "#ffffff" : "#374151",
        backgroundColor: isSelected ? accentColor || "#2563eb" : "#ffffff",
        border: `1px solid ${isSelected ? (accentColor || "#2563eb") : "#e5e7eb"}`,
        borderRadius: "9999px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = accentColor || "#d1d5db";
          e.currentTarget.style.backgroundColor = accentColor ? `${accentColor}0D` : "#f9fafb";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "#e5e7eb";
          e.currentTarget.style.backgroundColor = "#ffffff";
        }
      }}
    >
      <span>{label}</span>
      {count != null && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "22px",
            height: "22px",
            padding: "0 7px",
            fontSize: "12px",
            fontWeight: 600,
            color: isSelected ? (accentColor || "#2563eb") : "#ffffff",
            backgroundColor: isSelected ? "#ffffff" : "#9ca3af",
            borderRadius: "9999px",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 14px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#6b7280",
        backgroundColor: "transparent",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        cursor: "pointer",
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#f9fafb";
        e.currentTarget.style.borderColor = "#d1d5db";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.borderColor = "#e5e7eb";
      }}
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </button>
  );
}

function DivisionSection({
  group,
  columns,
  selectedDivision,
  selectedDepartment,
  onSelectDivision,
  onSelectDepartment,
  onClearDepartment,
}: {
  group: DivisionGroup;
  columns: number;
  selectedDivision: string | null;
  selectedDepartment: string | null;
  onSelectDivision: (name: string) => void;
  onSelectDepartment: (name: string) => void;
  onClearDepartment: () => void;
}): React.ReactElement {
  const isMultiDepartment = group.departments.length > 1;
  const isSelectedDivision = selectedDivision === group.division.name;
  const divisionId = useId();

  if (!isMultiDepartment) {
    const department = group.departments[0];
    if (!department) return <></>;

    const isSelected = isSelectedDivision;
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {isSelected ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <BackButton onClick={() => onSelectDivision("")} label="All divisions" />
              <h2
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#111827",
                  lineHeight: 1.3,
                  fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
                }}
              >
                {group.division.name}
              </h2>
            </div>
            <CourseCards courses={department.courses} columns={columns} />
          </>
        ) : (
          <div>
            <Bubble
              label={group.division.name}
              count={department.courses.length}
              onClick={() => onSelectDivision(group.division.name)}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {!isSelectedDivision ? (
        <div>
          <Bubble
            label={group.division.name}
            count={group.departments.reduce((sum, d) => sum + d.courses.length, 0)}
            onClick={() => onSelectDivision(group.division.name)}
          />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <BackButton onClick={() => onSelectDivision("")} label="All divisions" />
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                color: "#111827",
                lineHeight: 1.3,
                fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
              }}
            >
              {group.division.name}
            </h2>
          </div>

          {selectedDepartment == null ||
          !group.departments.some((d) => d.department.name === selectedDepartment) ? (
            <div
              id={divisionId}
              role="region"
              aria-label={`Departments in ${group.division.name}`}
              style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}
            >
              {group.departments.map((department) => (
                <Bubble
                  key={department.department.name}
                  label={department.department.name}
                  count={department.courses.length}
                  onClick={() => onSelectDepartment(department.department.name)}
                />
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <BackButton onClick={onClearDepartment} label="Departments" />
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "#111827",
                    fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
                  }}
                >
                  {selectedDepartment}
                </h3>
              </div>
              {group.departments
                .filter((d) => d.department.name === selectedDepartment)
                .map((department) => (
                  <CourseCards
                    key={department.department.name}
                    courses={department.courses}
                    columns={columns}
                  />
                ))}
            </>
          )}
        </>
      )}
    </section>
  );
}

export function CourseGrid({ groupedCourses }: CourseGridProps): React.ReactElement {
  const columns = useColumnCount();
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const visibleGroups = selectedDivision
    ? groupedCourses.filter((g) => g.division.name === selectedDivision)
    : groupedCourses;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      {selectedDivision == null && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {groupedCourses.map((group) => (
            <Bubble
              key={group.division.name}
              label={group.division.name}
              count={group.departments.reduce((sum, d) => sum + d.courses.length, 0)}
              isSelected={false}
              onClick={() => {
                setSelectedDivision(group.division.name);
                setSelectedDepartment(null);
              }}
            />
          ))}
        </div>
      )}

      {visibleGroups.map((group) => (
        <DivisionSection
          key={group.division.name}
          group={group}
          columns={columns}
          selectedDivision={selectedDivision}
          selectedDepartment={selectedDepartment}
          onSelectDivision={(name) => {
            setSelectedDivision(name || null);
            setSelectedDepartment(null);
          }}
          onSelectDepartment={setSelectedDepartment}
          onClearDepartment={() => setSelectedDepartment(null)}
        />
      ))}
    </div>
  );
}

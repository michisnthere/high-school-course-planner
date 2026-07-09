"use client";

import React from "react";

export type ActiveFilters = {
  department: string;
  creditType: string;
  gradeLevel: string;
  semester: string;
};

type CourseFiltersProps = {
  departments: string[];
  creditTypes: string[];
  gradeLevels: number[];
  semesters: string[];
  filters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
};

const FILTER_LABELS: Record<keyof ActiveFilters, string> = {
  department: "Department",
  creditType: "Credit Type",
  gradeLevel: "Grade Level",
  semester: "Semester",
};

const baseSelectStyle: React.CSSProperties = {
  height: "40px",
  padding: "0 14px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#374151",
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const activeChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#374151",
  backgroundColor: "#f3f4f6",
  borderRadius: "9999px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const clearButtonStyle: React.CSSProperties = {
  height: "32px",
  padding: "0 14px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#374151",
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

export function CourseFilters({
  departments,
  creditTypes,
  gradeLevels,
  semesters,
  filters,
  onFilterChange,
}: CourseFiltersProps): React.ReactElement {
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleChange = (key: keyof ActiveFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      department: "",
      creditType: "",
      gradeLevel: "",
      semester: "",
    });
  };

  const renderOptions = (label: string, values: string[]) => (
    <>
      <option value="">{label}</option>
      {values.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </>
  );

  return (
    <div style={{ marginBottom: "32px" }}>
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: activeFilterCount > 0 ? "16px" : "0",
        }}
      >
        <select
          aria-label="Filter by department"
          value={filters.department}
          onChange={(e) => handleChange("department", e.target.value)}
          style={baseSelectStyle}
        >
          {renderOptions("Department", departments)}
        </select>

        <select
          aria-label="Filter by credit type"
          value={filters.creditType}
          onChange={(e) => handleChange("creditType", e.target.value)}
          style={baseSelectStyle}
        >
          {renderOptions("Credit Type", creditTypes)}
        </select>

        <select
          aria-label="Filter by grade level"
          value={filters.gradeLevel}
          onChange={(e) => handleChange("gradeLevel", e.target.value)}
          style={baseSelectStyle}
        >
          <option value="">Grade Level</option>
          {gradeLevels.map((grade) => (
            <option key={grade} value={String(grade)}>
              {grade}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by semester"
          value={filters.semester}
          onChange={(e) => handleChange("semester", e.target.value)}
          style={baseSelectStyle}
        >
          {renderOptions("Semester", semesters)}
        </select>
      </div>

      {activeFilterCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(Object.keys(filters) as Array<keyof ActiveFilters>).map((key) => {
              const value = filters[key];
              if (!value) return null;
              return (
                <span key={key} style={activeChipStyle}>
                  {FILTER_LABELS[key]}: {value}
                </span>
              );
            })}
          </div>
          <button type="button" onClick={clearFilters} style={clearButtonStyle}>
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}

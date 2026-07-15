"use client";

import React, { useMemo } from "react";
import { formatCreditType, formatSemesterLabel } from "@/lib/catalog";

const formatCreditTypeFilter = (value: string) => formatCreditType(value) ?? value;

export type ActiveFilters = {
  division: string[];
  department: string[];
  creditType: string[];
  gradeLevel: string[];
  semester: string[];
};

type CourseFiltersProps = {
  divisions: string[];
  divisionDepartments: Map<string, string[]>;
  departments: string[];
  creditTypes: string[];
  gradeLevels: number[];
  semesters: string[];
  filters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
};

const activeChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  backgroundColor: "var(--bg-input)",
  borderRadius: "9999px",
};

const clearButtonStyle: React.CSSProperties = {
  height: "32px",
  padding: "0 14px",
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--text-secondary)",
  backgroundColor: "transparent",
  border: "1px solid var(--btn-secondary-border)",
  borderRadius: "8px",
  cursor: "pointer",
};

function ToggleGroup({
  label,
  values,
  selected,
  onToggle,
  formatLabel,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  formatLabel?: (value: string) => string;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {values.map((value) => {
          const isSelected = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(value)}
              style={{
                padding: "8px 14px",
                fontSize: "14px",
                fontWeight: 500,
                color: isSelected ? "#FFFFFF" : "var(--text-secondary)",
                backgroundColor: isSelected ? "var(--brand-accent)" : "transparent",
                border: `1px solid ${isSelected ? "var(--brand-accent)" : "var(--btn-secondary-border)"}`,
                borderRadius: "9999px",
                cursor: "pointer",
              }}
            >
              {formatLabel ? formatLabel(value) : value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CourseFilters({
  divisions,
  divisionDepartments,
  departments,
  creditTypes,
  gradeLevels,
  semesters,
  filters,
  onFilterChange,
}: CourseFiltersProps): React.ReactElement {
  const hasActiveFilters = useMemo(
    () =>
      filters.division.length > 0 ||
      filters.department.length > 0 ||
      filters.creditType.length > 0 ||
      filters.gradeLevel.length > 0 ||
      filters.semester.length > 0,
    [filters]
  );

  const toggleFilter = (
    category: keyof ActiveFilters,
    value: string
  ) => {
    const current = filters[category];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFilterChange({ ...filters, [category]: next });
  };

  const clearAll = () => {
    onFilterChange({
      division: [],
      department: [],
      creditType: [],
      gradeLevel: [],
      semester: [],
    });
  };

  const activeCount =
    filters.division.length +
    filters.department.length +
    filters.creditType.length +
    filters.gradeLevel.length +
    filters.semester.length;

  const visibleDepartments = useMemo(() => {
    if (filters.division.length === 0) return departments;
    const deptSet = new Set<string>();
    for (const div of filters.division) {
      const depts = divisionDepartments.get(div);
      if (depts) depts.forEach((d) => deptSet.add(d));
    }
    return Array.from(deptSet).sort();
  }, [filters.division, divisionDepartments, departments]);

  const showDepartmentFilter = useMemo(() => {
    if (filters.division.length === 0) return departments.length > 0;
    return filters.division.some((div) => {
      const depts = divisionDepartments.get(div);
      if (!depts || depts.length === 0) return false;
      if (depts.length > 1) return true;
      return depts[0] !== div;
    });
  }, [filters.division, divisionDepartments, departments]);

  return (
    <div
      style={{
        marginBottom: "24px",
        padding: "20px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        <ToggleGroup
          label="Division"
          values={divisions}
          selected={filters.division}
          onToggle={(value) => toggleFilter("division", value)}
        />
        {showDepartmentFilter && (
          <ToggleGroup
            label="Department"
            values={visibleDepartments}
            selected={filters.department}
            onToggle={(value) => toggleFilter("department", value)}
          />
        )}
        <ToggleGroup
          label="Credit Type"
          values={creditTypes}
          selected={filters.creditType}
          onToggle={(value) => toggleFilter("creditType", value)}
          formatLabel={formatCreditTypeFilter}
        />
        <ToggleGroup
          label="Grade Level"
          values={gradeLevels.map(String)}
          selected={filters.gradeLevel}
          onToggle={(value) => toggleFilter("gradeLevel", value)}
          formatLabel={(v) => `Grade ${v}`}
        />
        <ToggleGroup
          label="Semester"
          values={semesters}
          selected={filters.semester}
          onToggle={(value) => toggleFilter("semester", value)}
          formatLabel={formatSemesterLabel}
        />
      </div>

      {hasActiveFilters && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-default)",
          }}
        >
          <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Active filters ({activeCount})
          </span>
          <span style={{ color: "var(--border-default)" }}>|</span>
          <button type="button" onClick={clearAll} style={clearButtonStyle}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

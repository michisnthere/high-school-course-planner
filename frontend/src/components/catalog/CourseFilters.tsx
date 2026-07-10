"use client";

import React, { useMemo } from "react";

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

function ToggleGroup({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#ffffff",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
                color: isSelected ? "#ffffff" : "#374151",
                backgroundColor: isSelected ? "#2563eb" : "#ffffff",
                border: `1px solid ${isSelected ? "#2563eb" : "#e5e7eb"}`,
                borderRadius: "9999px",
                cursor: "pointer",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              }}
            >
              {value}
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
  const activeFilterCount = Object.values(filters).reduce(
    (sum, values) => sum + values.length,
    0
  );

  const availableDepartments = useMemo(() => {
    if (filters.division.length === 0) return departments;
    const set = new Set<string>();
    for (const division of filters.division) {
      for (const dept of divisionDepartments.get(division) ?? []) {
        set.add(dept);
      }
    }
    return Array.from(set).sort();
  }, [filters.division, divisionDepartments, departments]);

  const handleToggle = (key: keyof ActiveFilters, value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    if (key === "division") {
      // When a division is selected, only keep departments that belong to one
      // of the selected divisions. When no division is selected, leave the
      // department choices untouched.
      const nextDivisions = next;
      let nextDepartments = filters.department;
      if (nextDivisions.length > 0) {
        const validDepartments = new Set<string>();
        for (const division of nextDivisions) {
          for (const dept of divisionDepartments.get(division) ?? []) {
            validDepartments.add(dept);
          }
        }
        nextDepartments = filters.department.filter((d) => validDepartments.has(d));
      }
      onFilterChange({ ...filters, division: nextDivisions, department: nextDepartments });
      return;
    }

    onFilterChange({ ...filters, [key]: next });
  };

  const clearFilters = () => {
    onFilterChange({
      division: [],
      department: [],
      creditType: [],
      gradeLevel: [],
      semester: [],
    });
  };

  const groups: Array<{
    key: keyof ActiveFilters;
    label: string;
    values: string[];
  }> = [
    { key: "division", label: "Division", values: divisions },
    { key: "department", label: "Department", values: availableDepartments },
    { key: "creditType", label: "Credit Type", values: creditTypes },
    {
      key: "gradeLevel",
      label: "Grade Level",
      values: gradeLevels.map(String),
    },
    { key: "semester", label: "Semester", values: semesters },
  ];

  return (
    <div style={{ marginBottom: "32px" }}>
      <div
        style={{
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
          marginBottom: activeFilterCount > 0 ? "16px" : "0",
        }}
      >
        {groups.map((group) => (
          <ToggleGroup
            key={group.key}
            label={group.label}
            values={group.values}
            selected={filters[group.key]}
            onToggle={(value) => handleToggle(group.key, value)}
          />
        ))}
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
            {groups.flatMap((group) =>
              filters[group.key].map((value) => (
                <span key={`${group.key}-${value}`} style={activeChipStyle}>
                  {group.label}: {value}
                </span>
              ))
            )}
          </div>
          <button type="button" onClick={clearFilters} style={clearButtonStyle}>
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}

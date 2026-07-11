"use client";

import React, { useMemo } from "react";
import { formatCreditType } from "@/lib/catalog";

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
  const activeFilterCount = Object.values(filters).reduce(
    (sum, values) => sum + values.length,
    0
  );

  const selectedDivision = filters.division[0] ?? null;

  const availableDepartments = useMemo(() => {
    if (!selectedDivision) return [];
    return divisionDepartments.get(selectedDivision) ?? [];
  }, [selectedDivision, divisionDepartments]);

  const isDepartmentRedundant =
    selectedDivision != null &&
    availableDepartments.length === 1 &&
    availableDepartments[0] === selectedDivision;

  const handleDivisionToggle = (value: string) => {
    if (selectedDivision === value) {
      // Clearing the division hides the department selector again.
      onFilterChange({ ...filters, division: [], department: [] });
      return;
    }

    // Only one division may be selected at a time. Changing divisions replaces
    // the department list and clears the current department selection.
    onFilterChange({ ...filters, division: [value], department: [] });
  };

  const handleToggle = (key: keyof ActiveFilters, value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

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

  const otherGroups: Array<{
    key: keyof ActiveFilters;
    label: string;
    values: string[];
  }> = [
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
        <ToggleGroup
          label="Division"
          values={divisions}
          selected={filters.division}
          onToggle={handleDivisionToggle}
        />

        {selectedDivision != null && !isDepartmentRedundant && (
          <ToggleGroup
            label="Department"
            values={availableDepartments}
            selected={filters.department}
            onToggle={(value) => handleToggle("department", value)}
          />
        )}

        {otherGroups.map((group) => (
          <ToggleGroup
            key={group.key}
            label={group.label}
            values={group.values}
            selected={filters[group.key]}
            onToggle={(value) => handleToggle(group.key, value)}
            formatLabel={group.key === "creditType" ? formatCreditTypeFilter : undefined}
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
            {filters.division.map((value) => (
              <span key={`division-${value}`} style={activeChipStyle}>
                Division: {value}
              </span>
            ))}
            {filters.department.map((value) => (
              <span key={`department-${value}`} style={activeChipStyle}>
                Department: {value}
              </span>
            ))}
            {otherGroups.flatMap((group) =>
              filters[group.key].map((value) => (
                <span key={`${group.key}-${value}`} style={activeChipStyle}>
                  {group.label}: {group.key === "creditType" ? formatCreditTypeFilter(value) : value}
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

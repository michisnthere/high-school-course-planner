import React from "react";

const filters = [
  { label: "Department", value: "" },
  { label: "Division", value: "" },
  { label: "Credit Type", value: "" },
];

export function CourseFilters(): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "32px",
      }}
    >
      {filters.map((filter) => (
        <select
          key={filter.label}
          defaultValue={filter.value}
          disabled
          style={{
            height: "40px",
            padding: "0 14px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#374151",
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "not-allowed",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          <option value="">{filter.label}</option>
        </select>
      ))}
    </div>
  );
}

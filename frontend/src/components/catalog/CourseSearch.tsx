"use client";

import React from "react";

type CourseSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

export function CourseSearch({ query, onQueryChange }: CourseSearchProps): React.ReactElement {
  return (
    <div style={{ marginBottom: "24px" }}>
      <input
        type="text"
        aria-label="Search courses"
        placeholder="Search courses..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        style={{
          width: "100%",
          maxWidth: "480px",
          height: "44px",
          padding: "0 18px",
          fontSize: "15px",
          color: "#374151",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "9999px",
          outline: "none",
          boxSizing: "border-box",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      />
    </div>
  );
}

import React from "react";

export function CourseSearch(): React.ReactElement {
  return (
    <div style={{ marginBottom: "24px" }}>
      <input
        type="text"
        placeholder="Search courses..."
        readOnly
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

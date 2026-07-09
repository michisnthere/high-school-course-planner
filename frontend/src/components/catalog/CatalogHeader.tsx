import React from "react";

export function CatalogHeader(): React.ReactElement {
  return (
    <div style={{ marginBottom: "32px" }}>
      <h1
        style={{
          margin: 0,
          fontSize: "32px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Course Catalog
      </h1>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: "16px",
          color: "#d1d5db",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Browse every course available at Stevenson High School.
      </p>
    </div>
  );
}

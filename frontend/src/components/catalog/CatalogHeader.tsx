import React from "react";
import Link from "next/link";

export function CatalogHeader(): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        marginBottom: "32px",
      }}
    >
      <div>
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

      <Link
        href="/saved"
        style={{
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          height: "40px",
          padding: "0 18px",
          fontSize: "14px",
          fontWeight: 600,
          color: "#ffffff",
          backgroundColor: "#2563eb",
          borderRadius: "8px",
          textDecoration: "none",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        View Saved Courses
      </Link>
    </div>
  );
}

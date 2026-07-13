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
            color: "var(--text-primary)",
            lineHeight: 1.2,
          }}
        >
          Course Catalog
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "16px",
            color: "var(--text-secondary)",
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
          color: "var(--btn-primary-text)",
          backgroundColor: "var(--brand-primary)",
          borderRadius: "8px",
          textDecoration: "none",
        }}
      >
        View Saved Courses
      </Link>
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import type { PlannerCourseDetails } from "@/lib/planner";
import { getCourseSlug } from "@/lib/normalize";

type CourseDetailPopoverProps = {
  course: PlannerCourseDetails;
  returnUrl?: string;
  onClose: () => void;
};

function TagList({ items }: { items: string[] }): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          style={{
            padding: "4px 10px",
            backgroundColor: "#f3f4f6",
            borderRadius: "9999px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#374151",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function CourseDetailPopover({
  course,
  returnUrl,
  onClose,
}: CourseDetailPopoverProps): React.ReactElement {
  const slug = getCourseSlug({ title: course.title, normalizedTitle: course.normalizedTitle });
  const fullCatalogUrl = `/catalog/${slug}${returnUrl ? `?return=${encodeURIComponent(returnUrl)}` : ""}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "80vh",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "24px 24px 16px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                color: "#111827",
                lineHeight: 1.3,
              }}
            >
              {course.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                flex: "0 0 auto",
                fontSize: "24px",
                color: "#9ca3af",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            {course.creditType && (
              <span
                style={{
                  padding: "4px 10px",
                  backgroundColor: "#eff6ff",
                  borderRadius: "9999px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#1d4ed8",
                }}
              >
                {course.creditType}
              </span>
            )}
            {course.credits != null && (
              <span
                style={{
                  padding: "4px 10px",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "9999px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                {course.credits} credits
              </span>
            )}
            {course.duration && (
              <span
                style={{
                  padding: "4px 10px",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "9999px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                {course.duration}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
          }}
        >
          {course.description && (
            <div style={{ marginBottom: "20px" }}>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Description
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "15px",
                  color: "#374151",
                  lineHeight: 1.6,
                }}
              >
                {course.description}
              </p>
            </div>
          )}

          {course.prerequisites.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Prerequisites
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  fontSize: "15px",
                  color: "#374151",
                  lineHeight: 1.6,
                }}
              >
                {course.prerequisites.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {course.fulfillsRequirements.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Fulfills Graduation Requirements
              </h3>
              <TagList items={course.fulfillsRequirements} />
            </div>
          )}
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Link
            href={fullCatalogUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#2563eb",
              borderRadius: "8px",
              textDecoration: "none",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#1d4ed8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#2563eb";
            }}
          >
            Open Full Catalog Page
          </Link>
        </div>
      </div>
    </div>
  );
}

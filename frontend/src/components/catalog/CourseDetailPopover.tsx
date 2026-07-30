"use client";

import React from "react";
import Link from "next/link";
import type { PlannerCourseDetails } from "@/lib/planner";
import { formatCredits } from "@/lib/courseCredits";
import { getCourseSlug } from "@/lib/normalize";
import { formatCreditType, formatPrerequisiteForDisplay } from "@/lib/catalog";
import { useBreakpoint } from "@/hooks/useBreakpoint";

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
            backgroundColor: "var(--brand-accent-light)",
            borderRadius: "9999px",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
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
  const { isMobile: mobile } = useBreakpoint();
  const slug = getCourseSlug({ title: course.title, normalizedTitle: course.normalizedTitle });

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);
  const fullCatalogUrl = `/catalog/${slug}${returnUrl ? `?return=${encodeURIComponent(returnUrl)}` : ""}`;

  return (
    <>
      {mobile && <style>{`@keyframes cd-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: mobile ? "flex-end" : "center",
          justifyContent: "center",
          zIndex: 100,
          padding: mobile ? 0 : "24px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "100%",
            maxWidth: mobile ? "100%" : "520px",
            maxHeight: mobile ? "100%" : "80vh",
            height: mobile ? "100%" : "auto",
            backgroundColor: "var(--bg-card)",
            border: mobile ? "none" : "1px solid var(--border-default)",
            borderRadius: mobile ? 0 : "16px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: mobile ? "cd-slide-up 0.25s ease-out" : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: mobile ? "calc(16px + var(--safe-area-top, 0px)) 16px 12px" : "24px 24px 16px",
              borderBottom: "1px solid var(--border-default)",
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
                  fontSize: mobile ? "20px" : "22px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
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
                  width: mobile ? "44px" : "36px",
                  height: mobile ? "44px" : "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "8px",
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
                  backgroundColor: "var(--brand-accent-light)",
                  borderRadius: "9999px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {formatCreditType(course.creditType)}
              </span>
            )}
            {course.credits != null && (
              <span
                style={{
                  padding: "4px 10px",
                  backgroundColor: "var(--brand-accent-light)",
                  borderRadius: "9999px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {formatCredits(course.credits)} credits
              </span>
            )}
            {course.duration && (
              <span
                style={{
                  padding: "4px 10px",
                  backgroundColor: "var(--brand-accent-light)",
                  borderRadius: "9999px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
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
            padding: mobile ? "16px 16px" : "24px",
          }}
        >
          {course.description && (
            <div style={{ marginBottom: "20px" }}>
              <h3
                style={{
              margin: "0 0 8px",
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Description
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "15px",
                  color: "var(--text-secondary)",
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
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Prerequisites
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  fontSize: "15px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {course.prerequisites.map((item, index) => (
                  <li key={`${item}-${index}`}>{formatPrerequisiteForDisplay(item)}</li>
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
                fontWeight: 700,
                color: "var(--text-primary)",
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
            padding: mobile ? "12px 16px calc(16px + var(--safe-area-bottom, 0px))" : "16px 24px",
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Link
            href={fullCatalogUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: mobile ? "44px" : "38px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#FFFFFF",
              backgroundColor: "var(--brand-accent)",
              borderRadius: "8px",
              textDecoration: "none",
              transition: "background-color 0.2s ease",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--brand-accent-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--brand-accent)";
            }}
          >
            Open Full Catalog Page
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}

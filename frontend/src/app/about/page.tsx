import React from "react";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";

const sectionStyle: React.CSSProperties = {
  marginBottom: "32px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  color: "var(--text-primary)",
  margin: "0 0 12px",
};

const bodyStyle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.7,
  color: "var(--text-secondary)",
  margin: "0 0 8px",
};

const cardStyle: React.CSSProperties = {
  padding: "20px 24px",
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  marginBottom: "16px",
};

const statusGridStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

export default function AboutPage(): React.ReactElement {
  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-about-title {
            font-size: 1.5rem !important;
          }
        }
      `}</style>
      <ResponsivePage maxWidth={800}>
        <h1
          className="rs-about-title"
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "0 0 28px",
          }}
        >
          About
        </h1>

        <div style={cardStyle}>
          <p style={bodyStyle}>
            The Stevenson Course Planner is an unofficial planning tool created to help students
            understand graduation requirements, prerequisites, and course options before meeting
            with their counselor. It provides a visual way to explore how different course choices
            affect graduation progress across subject areas.
          </p>
          <p style={bodyStyle}>
            Official course requests are still made during your scheduled course selection
            appointment with your school counselor. This tool is meant to prepare you for that
            conversation, not replace it.
          </p>
          <p style={bodyStyle}>
            Course offerings, prerequisites, and graduation requirements are subject to change.
            Always verify current information with your counselor or the official course catalog.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>How It Works</h2>
          <div style={cardStyle}>
            <p style={bodyStyle}>
              Browse the course catalog to explore available classes and their prerequisites. Add
              courses to your plan, track completed courses, and monitor your graduation progress
              across all requirement areas. The planner gives you a real-time view of how your
              choices fit together.
            </p>
            <p style={bodyStyle}>
              You can experiment with different four-year plans, see which requirements are
              satisfied, and identify gaps before your counselor meeting.
            </p>
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>Project Status</h2>
          <div style={{ ...cardStyle, ...statusGridStyle }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  display: "inline-flex",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  backgroundColor: "var(--brand-accent-light)",
                  color: "var(--brand-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                Beta
              </span>
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                Active development — features and data are still being refined
              </span>
            </div>

            <p style={bodyStyle}>
              Built by a Stevenson student as a side project to help peers navigate course
              selection. This tool is intended to support — not replace — the guidance provided
              by school counselors.
            </p>

            <p style={bodyStyle}>
              If you encounter issues or have suggestions, use the Feedback page to report them.
              Your input helps make the planner better for everyone.
            </p>
          </div>
        </div>
      </ResponsivePage>
    </>
  );
}

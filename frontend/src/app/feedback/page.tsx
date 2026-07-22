import React from "react";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";

const cardStyle: React.CSSProperties = {
  padding: "24px",
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  marginBottom: "16px",
  textAlign: "center",
};

const bodyStyle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.7,
  color: "var(--text-secondary)",
  margin: "0 0 24px",
  textAlign: "center",
};

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 28px",
  fontSize: "15px",
  fontWeight: 500,
  borderRadius: "10px",
  textDecoration: "none",
  cursor: "pointer",
  transition: "background-color 0.15s",
  fontFamily: "var(--font-sans)",
  lineHeight: 1.4,
};

const FEEDBACK_FORM_URL = "https://forms.gle/gPebJ41P8r8sUEsW6";

export default function FeedbackPage(): React.ReactElement {
  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-feedback-title {
            font-size: 1.5rem !important;
          }
          .rs-feedback-btns {
            flex-direction: column !important;
          }
        }
        .rs-feedback-btn--bug:hover {
          background-color: #dc2626 !important;
        }
        .rs-feedback-btn--feedback:hover {
          background-color: var(--brand-accent) !important;
          opacity: 0.9;
        }
      `}</style>
      <ResponsivePage maxWidth={700}>
        <h1
          className="rs-feedback-title"
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "0 0 16px",
            textAlign: "center",
          }}
        >
          Feedback
        </h1>

        <div style={cardStyle}>
          <p style={bodyStyle}>
            Found a bug? Have a suggestion? Your feedback helps improve the planner for
            everyone. Use the buttons below to share details about what you encountered
            or what you would like to see added.
          </p>

          <div
            className="rs-feedback-btns"
            style={{
              display: "flex",
              gap: "16px",
              justifyContent: "center",
            }}
          >
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...btnStyle,
                backgroundColor: "#ef4444",
                color: "#ffffff",
                border: "none",
              }}
              className="rs-feedback-btn--bug"
            >
              Report a Bug
            </a>
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...btnStyle,
                backgroundColor: "var(--brand-accent)",
                color: "var(--text-on-accent)",
                border: "none",
              }}
              className="rs-feedback-btn--feedback"
            >
              Send Feedback
            </a>
          </div>
        </div>
      </ResponsivePage>
    </>
  );
}

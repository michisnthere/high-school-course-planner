import React from "react";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";

const cardStyle: React.CSSProperties = {
  padding: "20px 24px",
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  marginBottom: "16px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "18px",
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

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "12px 0 4px",
};

const listItemStyle: React.CSSProperties = {
  padding: "8px 0 8px 24px",
  fontSize: "15px",
  lineHeight: 1.5,
  color: "var(--text-secondary)",
  position: "relative",
};

export default function PrivacyPage(): React.ReactElement {
  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-privacy-title {
            font-size: 1.5rem !important;
          }
        }
        .rs-privacy-list-item::before {
          content: "\\2022";
          position: absolute;
          left: 8px;
          color: var(--brand-accent);
        }
      `}</style>
      <ResponsivePage maxWidth={800}>
        <h1
          className="rs-privacy-title"
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "0 0 28px",
          }}
        >
          Privacy
        </h1>

        <p
          style={{
            ...bodyStyle,
            marginBottom: "24px",
          }}
        >
          This page explains what data the Stevenson Course Planner stores and how it is used.
        </p>

        <div style={cardStyle}>
          <h2 style={headingStyle}>Signed-In Users</h2>
          <p style={bodyStyle}>
            When you sign in with Google, the following data is stored on the server and
            associated with your account:
          </p>
          <ul style={listStyle}>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              Your Google account name, email address, and Google ID (required for
              authentication)
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              Courses you have saved to your planner
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              Courses you have marked as completed
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              Your graduation progress across all requirement areas
            </li>
          </ul>
          <p style={bodyStyle}>
            This data is used only to provide planner functionality. No grades, transcripts,
            or personal academic records are collected or shared.
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={headingStyle}>Guest Users</h2>
          <p style={bodyStyle}>
            If you use the planner without signing in, all data exists only in your browser's
            memory. Refreshing or closing the tab clears all guest data. No guest information
            is stored on the server.
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={headingStyle}>Data Sharing</h2>
          <p style={bodyStyle}>
            Your data is used solely to provide the course planning functionality within this
            application. No planner data, course selections, or graduation information is
            shared with third parties, the school, or the school district.
          </p>
          <p style={bodyStyle}>
            This tool is not affiliated with or endorsed by the school district. It is an
            independent planning aid built to help students prepare for counselor meetings.
          </p>
        </div>
      </ResponsivePage>
    </>
  );
}

"use client";

import React from "react";
import Link from "next/link";

type SidebarFooterProps = {
  className?: string;
};

const FEEDBACK_FORM_URL = "https://forms.gle/gPebJ41P8r8sUEsW6";

export function SidebarFooter({ className }: SidebarFooterProps): React.ReactElement {
  const isMobile = !!className;

  return (
    <div className={className} style={className ? undefined : desktopStyle}>
      <p style={className ? mobileLabelStyle : labelStyle}>
        Stevenson Course Planner
        <br />
        Beta v1.0
      </p>
      {isMobile ? (
        <div style={linkRowStyle}>
          <Link href="/about" style={mobileLinkStyle}>About</Link>
          <span style={mobileDotStyle}>•</span>
          <Link href="/privacy" style={mobileLinkStyle}>Privacy</Link>
          <span style={mobileDotStyle}>•</span>
          <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" style={mobileLinkStyle}>Report a Bug</a>
          <span style={mobileDotStyle}>•</span>
          <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" style={mobileLinkStyle}>Send Feedback</a>
        </div>
      ) : (
        <div style={verticalLinkStyle}>
          <Link href="/about" style={linkStyle}>About</Link>
          <Link href="/privacy" style={linkStyle}>Privacy</Link>
          <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>Report a Bug</a>
          <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>Send Feedback</a>
        </div>
      )}
      <p style={className ? mobileSubtextStyle : subtextStyle}>
        Unofficial planning resource for Stevenson High School.
      </p>
    </div>
  );
}

const desktopStyle: React.CSSProperties = {
  padding: "0 4px",
};

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--sidebar-text)",
  lineHeight: 1.4,
};

const linkRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginTop: "8px",
};

const verticalLinkStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  marginTop: "8px",
};

const linkStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--sidebar-text-hover)",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const dotStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--sidebar-text-hover)",
};

const subtextStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "11px",
  color: "var(--sidebar-text)",
  opacity: 0.8,
  lineHeight: 1.4,
};

const mobileLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--text-primary)",
  lineHeight: 1.4,
};

const mobileLinkStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const mobileDotStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
};

const mobileSubtextStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "12px",
  color: "var(--text-muted)",
  lineHeight: 1.4,
};

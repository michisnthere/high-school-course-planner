"use client";

import React from "react";
import Link from "next/link";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";

type GuestEmptyStateProps = {
  title: string;
  description: string;
};

const guestButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "8px 20px",
  fontSize: "15px",
  fontWeight: 500,
  color: "#FFFFFF",
  backgroundColor: "var(--brand-accent)",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  textDecoration: "none",
  boxSizing: "border-box",
};

export function GuestEmptyState({
  title,
  description,
}: GuestEmptyStateProps): React.ReactElement {
  return (
    <ResponsivePage>
      <h1
        style={{
          margin: "0 0 24px",
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h1>
      <div
        style={{
          padding: "24px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "12px",
        }}
      >
        <p
          style={{
            margin: "0 0 24px",
            fontSize: "15px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            maxWidth: "600px",
          }}
        >
          {description}
        </p>
        <Link href="/login" style={guestButtonStyle}>
          Sign In
        </Link>
      </div>
    </ResponsivePage>
  );
}

export default GuestEmptyState;

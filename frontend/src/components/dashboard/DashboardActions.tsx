"use client";

import React, { useState } from "react";
import Link from "next/link";

const actions = [
  { label: "Browse Catalog", href: "/catalog" },
  { label: "My Planner", href: "/planner" },
  { label: "Graduation Requirements", href: "/requirements" },
];

export function DashboardActions(): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "32px",
      }}
    >
      {actions.map((action) => (
        <ActionCard key={action.label} action={action} />
      ))}
    </div>
  );
}

type ActionCardProps = {
  action: {
    label: string;
    href: string;
  };
};

function ActionCard({ action }: ActionCardProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={action.href}
      style={{
        flex: "1 1 0",
        minWidth: "220px",
        textDecoration: "none",
        color: "inherit",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          padding: "24px",
          backgroundColor: "#ffffff",
          border: "1px solid",
          borderColor: hovered ? "#d1d5db" : "#e5e7eb",
          borderRadius: "12px",
          transition: "border-color 0.2s ease",
          cursor: "pointer",
          textAlign: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <span
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          {action.label}
        </span>
      </div>
    </Link>
  );
}

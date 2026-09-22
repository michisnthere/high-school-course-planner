"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/context/I18nContext";

export function DashboardActions(): React.ReactElement {
  const { t } = useTranslation();
  const actions = [
    { label: t("dashboard.browseCourses"), href: "/catalog" },
    { label: t("dashboard.actionPlanner"), href: "/planner" },
    { label: t("dashboard.actionGraduationRequirements"), href: "/requirements" },
  ];

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
        minWidth: "200px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          padding: "20px",
          backgroundColor: hovered ? "var(--brand-accent-hover)" : "var(--brand-accent)",
          borderRadius: "12px",
          transition: "background-color 0.2s ease",
          cursor: "pointer",
          textAlign: "center",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: "#ffffff",
          }}
        >
          {action.label}
        </span>
      </div>
    </Link>
  );
}

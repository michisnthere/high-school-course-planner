"use client";

import React from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { useTranslation } from "@/context/I18nContext";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";

export default function ProfilePage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <ProtectedRoute>
      <ResponsivePage>
        <h1
          style={{
            margin: "0 0 24px",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          {t("profile.heading")}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: "16px",
            color: "var(--text-secondary)",
          }}
        >
          {t("profile.description")}
        </p>
        <AuthStatus />
      </ResponsivePage>
    </ProtectedRoute>
  );
}

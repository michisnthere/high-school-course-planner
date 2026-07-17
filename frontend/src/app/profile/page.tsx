"use client";

import React from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";

export default function ProfilePage(): React.ReactElement {
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
          Your Profile
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: "16px",
            color: "var(--text-secondary)",
          }}
        >
          This page is only visible to signed-in users. More account settings
          will be added here once user accounts are persisted in the database.
        </p>
        <AuthStatus />
      </ResponsivePage>
    </ProtectedRoute>
  );
}

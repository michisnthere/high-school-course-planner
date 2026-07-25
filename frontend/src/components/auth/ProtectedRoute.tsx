"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  fallback,
}: ProtectedRouteProps): React.ReactElement | null {
  const { mode, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: "32px" }}>
        Loading...
      </div>
    );
  }

  if (!mode) {
    if (fallback) {
      return <>{fallback}</>;
    }
    const currentPath = window.location.pathname + window.location.search;
    const returnParam = encodeURIComponent(currentPath);
    window.location.href = `/login?return=${returnParam}`;
    return null;
  }

  return <>{children}</>;
}

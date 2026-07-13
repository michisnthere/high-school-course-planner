"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Route protection utility.
 *
 * Wrap a page or section with this component to require authentication.
 * Unauthenticated users are redirected to /login. This component is not
 * applied to /catalog or /catalog/[slug] by design, so the catalog remains
 * publicly accessible.
 */
export function ProtectedRoute({
  children,
  fallback,
}: ProtectedRouteProps): React.ReactElement | null {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          padding: "32px",

        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
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

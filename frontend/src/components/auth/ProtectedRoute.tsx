"use client";

import React, { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";

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
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    getSession()
      .then((session) => {
        setAuthenticated(session.authenticated);
      })
      .catch(() => {
        setAuthenticated(false);
      });
  }, []);

  useEffect(() => {
    if (authenticated === false) {
      window.location.href = "/login";
    }
  }, [authenticated]);

  if (authenticated === null) {
    return (
      <div
        style={{
          padding: "32px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Loading...
      </div>
    );
  }

  if (authenticated === false) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

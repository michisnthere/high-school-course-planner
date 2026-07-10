"use client";

import React, { useEffect, useState } from "react";
import { getSession, logout, type AuthUser } from "@/lib/auth";

export function AuthStatus(): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((session) => {
        setUser(session.authenticated ? session.user ?? null : null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSignIn = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/auth/google`;
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      // Ignore logout errors; session is cleared on the backend if it exists.
    }
    setUser(null);
    window.location.href = "/";
  };

  if (loading) {
    return (
      <span
        style={{
          fontSize: "0.9375rem",
          color: "#9ca3af",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Loading...
      </span>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        style={{
          height: "40px",
          padding: "0 16px",
          fontSize: "0.9375rem",
          fontWeight: 500,
          color: "#ffffff",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "8px",
          cursor: "pointer",
          boxSizing: "border-box",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Sign In
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontSize: "0.9375rem",
          fontWeight: 500,
          color: "#ffffff",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {user.name || user.email}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        style={{
          height: "40px",
          padding: "0 16px",
          fontSize: "0.9375rem",
          fontWeight: 500,
          color: "#ffffff",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "8px",
          cursor: "pointer",
          boxSizing: "border-box",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        Sign Out
      </button>
    </div>
  );
}

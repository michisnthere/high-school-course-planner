"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";

export function AuthStatus(): React.ReactElement {
  const { user, loading, logout } = useAuth();

  const handleSignIn = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ""}/auth/google`;
  };

  const handleSignOut = async () => {
    await logout();
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
          color: "var(--btn-primary-text)",
          backgroundColor: "var(--brand-primary)",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          boxSizing: "border-box",
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
          color: "var(--text-primary)",
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
          color: "var(--text-primary)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          cursor: "pointer",
          boxSizing: "border-box",
        }}
      >
        Sign Out
      </button>
    </div>
  );
}

"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";

export function AuthStatus(): React.ReactElement {
  const { user, loading, logout } = useAuth();

  const handleSignIn = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const currentPath = window.location.pathname + window.location.search;
    const redirectParam = currentPath !== "/login" ? `?redirect=${encodeURIComponent(currentPath)}` : "";
    const signInUrl = `${apiUrl}/auth/google${redirectParam}`;
    console.log(`[AUTH-DEBUG] handleSignIn: NEXT_PUBLIC_API_URL=${apiUrl || "(empty)"}, signInUrl=${signInUrl}`);
    window.location.href = signInUrl;
  };

  const handleSignOut = async () => {
    await logout();
  };

  if (loading) {
    return (
      <span
        style={{
          fontSize: "0.9375rem",
          color: "var(--nav-text)",
          opacity: 0.7,
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
          color: "#FFFFFF",
          backgroundColor: "var(--brand-accent)",
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
          fontSize: "0.875rem",
          fontWeight: 400,
          color: "var(--nav-text)",
        }}
      >
        {user.name || user.email}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        style={{
          height: "36px",
          padding: "0 14px",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--nav-text)",
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
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

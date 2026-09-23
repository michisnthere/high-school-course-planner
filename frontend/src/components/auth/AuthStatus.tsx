"use client";

import React from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";

export function AuthStatus(): React.ReactElement {
  const { user, mode, loading, logout } = useAuth();
  const { t } = useTranslation();

  const handleSignIn = () => {
    const currentPath = window.location.pathname + window.location.search;
    const redirectParam = currentPath !== "/login" ? `?redirect=${encodeURIComponent(currentPath)}` : "";
    sessionStorage.setItem("authToast", JSON.stringify({ type: "signIn" }));
    window.location.href = `/auth/google${redirectParam}`;
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
        {t("auth.loading")}
      </span>
    );
  }

  if (!mode) {
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
        {t("auth.signIn")}
      </button>
    );
  }

  const isGuest = mode === "guest";

  // Authenticated user: show circular profile icon linking to /profile
  if (!isGuest) {
    return (
      <Link
        href="/profile"
        aria-label={t("aria.myProfile")}
        title={t("aria.myProfile")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          backgroundColor: "var(--a11y-button-bg)",
          border: "none",
          cursor: "pointer",
          textDecoration: "none",
          flexShrink: 0,
          transition: "background-color 0.15s",
        }}
      >
        <User size={20} color="var(--a11y-icon-color)" strokeWidth={1.8} />
      </Link>
    );
  }

  // Guest: show guest mode label and sign out
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "2px",
        }}
      >
        <span
          style={{
            fontSize: "0.875rem",
            fontWeight: 400,
            color: "var(--nav-text)",
          }}
        >
          {user?.name || user?.email}
        </span>
        <span
          style={{
            fontSize: "0.6875rem",
            color: "var(--brand-accent)",
            opacity: 0.8,
            lineHeight: 1.2,
          }}
          title={t("auth.guestModeTooltip")}
        >
          {t("auth.guestMode")}
        </span>
      </div>
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
        {t("auth.signOut")}
      </button>
    </div>
  );
}

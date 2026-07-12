"use client";

import React from "react";

export default function LoginPage(): React.ReactElement {
  const handleSignIn = () => {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("return") || "";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const redirectParam = returnUrl ? `?redirect=${encodeURIComponent(returnUrl)}` : "";
    window.location.href = `${apiUrl}/auth/google${redirectParam}`;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 64px)",
        padding: "32px",
        backgroundColor: "#f3f4f6",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "40px",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "16px",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "28px",
            fontWeight: 700,
            color: "#111827",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          Sign In
        </h1>
        <p
          style={{
            margin: "0 0 32px",
            fontSize: "16px",
            color: "#6b7280",
            lineHeight: 1.5,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          Sign in with your Google account to access your personalized course
          planner.
        </p>
        <button
          type="button"
          onClick={handleSignIn}
          style={{
            width: "100%",
            height: "48px",
            padding: "0 24px",
            fontSize: "16px",
            fontWeight: 600,
            color: "#ffffff",
            backgroundColor: "#111827",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            boxSizing: "border-box",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

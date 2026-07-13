"use client";

import React from "react";

export default function LoginPage(): React.ReactElement {
  const handleSignIn = () => {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("return") || "";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
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
        backgroundColor: "var(--bg-page)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "40px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
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
            color: "var(--brand-secondary)",
            lineHeight: 1.2,
          }}
        >
          Stevenson Course Planner
        </h1>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: "16px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Sign in with your Google account to access your personalized course
          planner.
        </p>
        <p
          style={{
            margin: "0 0 32px",
            fontSize: "14px",
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          Powered by Adlai E. Stevenson High School
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
            color: "var(--btn-primary-text)",
            backgroundColor: "var(--brand-primary)",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

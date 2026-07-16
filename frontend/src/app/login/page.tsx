"use client";

import React from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage(): React.ReactElement {
  const { loginAsGuest } = useAuth();

  const handleSignIn = () => {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("return") || "";
    const redirectParam = returnUrl ? `?redirect=${encodeURIComponent(returnUrl)}` : "";
    window.location.href = `/auth/google${redirectParam}`;
  };

  const handleGuest = () => {
    loginAsGuest();
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("return") || "";
    window.location.href = returnUrl || "/";
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 64px)",
        padding: "32px",
        backgroundColor: "var(--bg-muted)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "48px 40px 40px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "16px",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <Image
          src="/stevensonlogo.png"
          alt="Stevenson High School"
          width={64}
          height={64}
          style={{ margin: "0 auto 16px" }}
        />
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "26px",
            fontWeight: 700,
            color: "var(--brand-primary)",
            lineHeight: 1.2,
          }}
        >
          Stevenson Course Planner
        </h1>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: "15px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Sign in with your Google account to plan your courses, track requirements, and explore the
          Stevenson course catalog.
        </p>
        <p
          style={{
            margin: "0 0 32px",
            fontSize: "13px",
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
            fontWeight: 500,
            color: "#FFFFFF",
            backgroundColor: "var(--brand-accent)",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          Sign in with Google
        </button>
        <div style={{ marginTop: "16px" }}>
          <button
            type="button"
            onClick={handleGuest}
            style={{
              width: "100%",
              height: "48px",
              padding: "0 24px",
              fontSize: "16px",
              fontWeight: 500,
              color: "var(--text-secondary)",
              backgroundColor: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "10px",
              cursor: "pointer",
              boxSizing: "border-box",
            }}
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { breakpoints } from "@/lib/responsive";

export default function LoginPage(): React.ReactElement {
  const { loginAsGuest } = useAuth();

  const isValidRedirect = (url: string): boolean => {
    if (!url || url.startsWith("//")) return false;
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  };

  const handleSignIn = () => {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("return") || "";
    const safeReturn = isValidRedirect(returnUrl) ? returnUrl : "";
    const redirectParam = safeReturn ? `?redirect=${encodeURIComponent(safeReturn)}` : "";
    sessionStorage.setItem("authToast", JSON.stringify({ type: "signIn" }));
    window.location.href = `/auth/google${redirectParam}`;
  };

  const handleGuest = () => {
    loginAsGuest();
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("return") || "";
    const safeReturn = isValidRedirect(returnUrl) ? returnUrl : "/";
    sessionStorage.setItem("authToast", JSON.stringify({ type: "guest" }));
    window.location.href = safeReturn;
  };

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-login-wrapper {
            padding: 16px !important;
            padding-top: 0 !important;
            padding-bottom: calc(16px + var(--safe-area-bottom)) !important;
            padding-left: calc(16px + var(--safe-area-left)) !important;
            padding-right: calc(16px + var(--safe-area-right)) !important;
          }
          .rs-login-card {
            padding: 32px 24px 28px !important;
          }
        }
      `}</style>
      <div
        className="rs-login-wrapper"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100dvh - 64px)",
          padding: "32px",
          backgroundColor: "var(--bg-muted)",
          boxSizing: "border-box",
        }}
      >
        <div
          className="rs-login-card"
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
          <div style={{ height: "16px" }} />
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
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor: "var(--bg-muted)",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                Guest Mode
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                Your changes will not be saved after leaving this session.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

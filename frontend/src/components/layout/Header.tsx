import React from "react";
import Image from "next/image";
import Link from "next/link";
import { AuthStatus } from "@/components/auth/AuthStatus";

export function Header(): React.ReactElement {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px",
        padding: "0 24px",
        backgroundColor: "var(--bg-header)",
        boxSizing: "border-box",
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <Image
          src="/stevensonlogo.png"
          alt="Stevenson High School"
          width={32}
          height={32}
          style={{ flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--nav-text)",
            lineHeight: 1.2,
          }}
        >
          Stevenson Course Planner
        </span>
      </Link>

      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <AuthStatus />
      </div>
    </header>
  );
}

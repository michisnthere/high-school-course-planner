import React from "react";
import Image from "next/image";
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
        borderBottom: "1px solid var(--border-default)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Image
          src="/stevensonlogo.png"
          alt="Stevenson High School"
          width={36}
          height={36}
          style={{ flexShrink: 0 }}
        />
        <h1
          style={{
            margin: 0,
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--nav-text)",
            lineHeight: 1.2,
          }}
        >
          Stevenson Course Planner
        </h1>
      </div>
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

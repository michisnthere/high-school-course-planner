import React from "react";
import { AuthStatus } from "@/components/auth/AuthStatus";

export function Header(): React.ReactElement {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        height: "64px",
        padding: "0 24px",
        backgroundColor: "var(--bg-header)",
        boxSizing: "border-box",
      }}
    >
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

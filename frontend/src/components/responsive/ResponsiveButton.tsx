"use client";

import React from "react";
import { breakpoints } from "@/lib/responsive";

type ResponsiveButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: React.CSSProperties;
};

export function ResponsiveButton({
  children,
  onClick,
  variant = "primary",
  fullWidth,
  disabled,
  type = "button",
  style,
}: ResponsiveButtonProps) {
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "var(--brand-accent)",
      color: "var(--text-on-accent)",
      border: "none",
    },
    secondary: {
      backgroundColor: "var(--btn-secondary-bg)",
      color: "var(--btn-secondary-text)",
      border: "1px solid var(--btn-secondary-border)",
    },
    danger: {
      backgroundColor: "var(--btn-danger-bg)",
      color: "var(--btn-danger-text)",
      border: "1px solid var(--btn-danger-border)",
    },
  };

  return (
    <>
      <style>{`
        .rs-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px;
          font-size: 0.9375rem;
          font-weight: 500;
          border-radius: 10px;
          cursor: pointer;
          box-sizing: border-box;
          transition: background-color 0.15s, opacity 0.15s;
          font-family: var(--font-sans);
          line-height: 1.4;
        }
        .rs-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-btn.rs-btn--full {
            width: 100%;
          }
        }
      `}</style>
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`rs-btn${fullWidth ? " rs-btn--full" : ""}`}
        style={{
          ...variantStyles[variant],
          ...(fullWidth ? { width: "100%" } : {}),
          ...style,
        }}
      >
        {children}
      </button>
    </>
  );
}

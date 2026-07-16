import React from "react";
import { breakpoints } from "@/lib/responsive";

type MobileCardProps = {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  padding?: "sm" | "md" | "lg";
};

const paddingValues = {
  sm: 12,
  md: 16,
  lg: 24,
};

export function MobileCard({ children, onClick, style, padding = "md" }: MobileCardProps) {
  return (
    <>
      <style>{`
        .rs-mobile-card {
          background-color: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: 12px;
          box-sizing: border-box;
        }
        .rs-mobile-card--clickable {
          cursor: pointer;
        }
        .rs-mobile-card--clickable:hover {
          background-color: var(--bg-card-hover);
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-mobile-card {
            border-radius: 10px;
          }
        }
      `}</style>
      <div
        className={`rs-mobile-card${onClick ? " rs-mobile-card--clickable" : ""}`}
        onClick={onClick}
        style={{ padding: paddingValues[padding], ...style }}
      >
        {children}
      </div>
    </>
  );
}

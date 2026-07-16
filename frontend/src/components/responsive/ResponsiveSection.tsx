import React from "react";
import { breakpoints } from "@/lib/responsive";

type ResponsiveSectionProps = {
  children: React.ReactNode;
  gap?: number;
};

export function ResponsiveSection({ children, gap = 24 }: ResponsiveSectionProps) {
  return (
    <>
      <style>{`
        .rs-section {
          margin-bottom: ${gap}px;
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-section {
            margin-bottom: ${Math.max(gap - 8, 16)}px;
          }
        }
      `}</style>
      <div className="rs-section">{children}</div>
    </>
  );
}

import React from "react";
import { breakpoints } from "@/lib/responsive";

type ResponsivePageProps = {
  children: React.ReactNode;
  maxWidth?: number;
};

export function ResponsivePage({ children, maxWidth = 1200 }: ResponsivePageProps) {
  return (
    <>
      <style>{`
        .rs-page {
          padding: 32px;
          max-width: ${maxWidth}px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: ${breakpoints.tablet - 1}px) {
          .rs-page {
            padding: 24px;
          }
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-page {
            padding: 16px;
          }
        }
      `}</style>
      <div className="rs-page">{children}</div>
    </>
  );
}

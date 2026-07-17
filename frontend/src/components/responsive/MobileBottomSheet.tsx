"use client";

import React, { useEffect, useCallback } from "react";
import { breakpoints } from "@/lib/responsive";

type MobileBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

export function MobileBottomSheet({ isOpen, onClose, children, title }: MobileBottomSheetProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .rs-sheet-overlay {
          position: fixed;
          inset: 0;
          background: var(--bg-overlay);
          z-index: 1000;
          animation: rs-sheet-fade-in 0.2s ease-out;
        }
        .rs-sheet-panel {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--bg-card);
          border-radius: 16px 16px 0 0;
          z-index: 1001;
          max-height: 80vh;
          overflow-y: auto;
          animation: rs-sheet-slide-up 0.25s ease-out;
          box-sizing: border-box;
          padding-bottom: var(--safe-area-bottom);
        }
        .rs-sheet-handle {
          width: 36px;
          height: 4px;
          border-radius: 2px;
          background: var(--border-default);
          margin: 8px auto;
        }
        .rs-sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 24px 16px;
        }
        .rs-sheet-close {
          background: none;
          border: none;
          font-size: 1.25rem;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          line-height: 1;
        }
        @keyframes rs-sheet-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rs-sheet-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @media (min-width: ${breakpoints.tablet}px) {
          .rs-sheet-panel {
            max-width: 480px;
            left: auto;
            right: 24px;
            bottom: 24px;
            border-radius: 16px;
          }
        }
      `}</style>
      <div className="rs-sheet-overlay" onClick={onClose} />
      <div className="rs-sheet-panel">
        <div className="rs-sheet-handle" />
        <div className="rs-sheet-header">
          {title && (
            <span style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {title}
            </span>
          )}
          <button className="rs-sheet-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ padding: "0 24px 24px" }}>{children}</div>
      </div>
    </>
  );
}

"use client";

import React, { useEffect, useCallback } from "react";

type MobileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
};

export function MobileDrawer({ isOpen, onClose, children, side = "left" }: MobileDrawerProps) {
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

  const slideKey = side === "left" ? "rs-drawer-slide-left" : "rs-drawer-slide-right";
  const panelStyle: React.CSSProperties =
    side === "right"
      ? { right: 0, borderLeft: "1px solid var(--border-default)" }
      : { left: 0, borderRight: "1px solid var(--border-default)" };

  return (
    <>
      <style>{`
        .rs-drawer-overlay {
          position: fixed;
          inset: 0;
          background: var(--bg-overlay);
          z-index: 1000;
          animation: rs-drawer-fade-in 0.2s ease-out;
        }
        .rs-drawer-panel {
          position: fixed;
          top: 0;
          bottom: 0;
          width: 280px;
          max-width: 80vw;
          background: var(--bg-card);
          z-index: 1001;
          overflow-y: auto;
          animation: ${slideKey} 0.25s ease-out;
          box-sizing: border-box;
          padding-top: var(--safe-area-top);
          padding-bottom: var(--safe-area-bottom);
        }
        @keyframes rs-drawer-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rs-drawer-slide-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes rs-drawer-slide-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      <div className="rs-drawer-overlay" onClick={onClose} />
      <div className="rs-drawer-panel" style={panelStyle}>
        {children}
      </div>
    </>
  );
}

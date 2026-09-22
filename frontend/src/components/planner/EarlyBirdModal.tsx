"use client";

import React from "react";
import { useTranslation } from "@/context/I18nContext";

type EarlyBirdModalProps = {
  courseTitle: string;
  onSelect: (isEarlyBird: boolean) => void;
  onClose: () => void;
};

export function EarlyBirdModal({ courseTitle, onSelect, onClose }: EarlyBirdModalProps): React.ReactElement {
  const { t } = useTranslation();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="early-bird-modal-title"
        tabIndex={-1}
        style={{
          border: "1px solid #374151",
          borderRadius: "16px",
          padding: "32px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="early-bird-modal-title"
          style={{
            margin: "0 0 16px",
            fontSize: "22px",
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {t("plannerEarlyBird.takeEarlyBird")}
        </h2>

        <p style={{ margin: "0 0 8px", fontSize: "15px", color: "#e5e7eb", fontWeight: 600 }}>
          {courseTitle}
        </p>

        <div
          style={{
            margin: "16px 0",
            padding: "16px",
            backgroundColor: "#111827",
            borderRadius: "10px",
            fontSize: "14px",
            color: "#d1d5db",
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: "0 0 12px", fontWeight: 600, color: "#e5e7eb" }}>
            {t("plannerEarlyBird.earlyBirdClassesMeet")}
          </p>
          <p style={{ margin: "0 0 4px" }}>
            {t("plannerEarlyBird.mwf")}
          </p>
          <p style={{ margin: "0 0 12px", paddingLeft: "20px" }}>
            {t("plannerEarlyBird.mwfTime")}
          </p>
          <p style={{ margin: "0 0 12px" }}>
            {t("plannerEarlyBird.tt")}
          </p>
          <p style={{ margin: "0 0 16px", paddingLeft: "20px" }}>
            {t("plannerEarlyBird.ttTime")}
          </p>
          <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#fca5a5" }}>
            {t("plannerEarlyBird.pleaseNote")}
          </p>
          <p style={{ margin: "0 0 4px" }}>
            {t("plannerEarlyBird.noBus")}
          </p>
          <p style={{ margin: 0 }}>
            {t("plannerEarlyBird.transportationNote")}
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => onSelect(false)}
            style={{
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 500,
              color: "#ffffff",
              backgroundColor: "#374151",
              border: "1px solid #4b5563",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            {t("plannerEarlyBird.regularSection")}
          </button>
          <button
            type="button"
            onClick={() => onSelect(true)}
            style={{
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 500,
              color: "#111827",
              backgroundColor: "var(--brand-accent)",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            {t("plannerEarlyBird.earlyBirdButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

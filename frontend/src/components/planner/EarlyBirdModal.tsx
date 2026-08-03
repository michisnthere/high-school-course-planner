"use client";

import React from "react";

type EarlyBirdModalProps = {
  courseTitle: string;
  onSelect: (isEarlyBird: boolean) => void;
  onClose: () => void;
};

export function EarlyBirdModal({ courseTitle, onSelect, onClose }: EarlyBirdModalProps): React.ReactElement {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
        style={{
          width: "100%",
          maxWidth: "520px",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "16px",
          padding: "32px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "22px",
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          Take this course as Early Bird?
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
            Early Bird classes meet:
          </p>
          <p style={{ margin: "0 0 4px" }}>
            • Monday, Wednesday, Friday
          </p>
          <p style={{ margin: "0 0 12px", paddingLeft: "20px" }}>
            7:45 AM
          </p>
          <p style={{ margin: "0 0 12px" }}>
            • Tuesday, Thursday
          </p>
          <p style={{ margin: "0 0 16px", paddingLeft: "20px" }}>
            Regular school time
          </p>
          <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#fca5a5" }}>
            Please note:
          </p>
          <p style={{ margin: "0 0 4px" }}>
            • Stevenson does NOT provide bus transportation for Early Bird classes.
          </p>
          <p style={{ margin: 0 }}>
            • Students are responsible for arranging transportation on Monday, Wednesday, and Friday.
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
            Regular Section
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
            🐤 Early Bird
          </button>
        </div>
      </div>
    </div>
  );
}

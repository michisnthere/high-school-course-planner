"use client";

import React from "react";
import { CoursePicker } from "./CoursePicker";

type CourseSearchModalProps = {
  onClose: () => void;
  onSelect: (courseId: number) => void;
  isSaved: (courseId: number) => boolean;
};

export function CourseSearchModal({
  onClose,
  onSelect,
  isSaved,
}: CourseSearchModalProps): React.ReactElement {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "80vh",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",

        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "24px 24px 16px",
            borderBottom: "1px solid #374151",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              Add a Course
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: "24px",
                color: "#9ca3af",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <CoursePicker onSelect={onSelect} isSaved={isSaved} actionLabel="Add →" />
        </div>
      </div>
    </div>
  );
}

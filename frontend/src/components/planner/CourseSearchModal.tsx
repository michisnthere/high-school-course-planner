"use client";

import React from "react";
import { useTranslation } from "@/context/I18nContext";
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
        zIndex: 50,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-search-modal-title"
        tabIndex={-1}
        style={{
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
              id="course-search-modal-title"
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {t("plannerSearch.addCourse")}
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
              aria-label={t("planner.cancel")}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <CoursePicker onSelect={onSelect} isSaved={isSaved} actionLabel={t("plannerCourseCard.addToPlanner")} />
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { CoursePicker } from "./CoursePicker";
import {
  GRADE_COMPLETED_OPTIONS,
  LETTER_GRADE_OPTIONS,
  type GradeCompleted,
} from "@/lib/completedCourses";

type CompletedCoursePickerProps = {
  onClose: () => void;
  onSubmit: (selection: {
    courseId: number;
    gradeCompleted: GradeCompleted;
    letterGrade: string | null;
  }) => void;
  excludeCourseIds?: number[];
  defaultGrade?: GradeCompleted;
};

export function CompletedCoursePicker({
  onClose,
  onSubmit,
  excludeCourseIds,
  defaultGrade = "Freshman (9)",
}: CompletedCoursePickerProps): React.ReactElement {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [gradeCompleted, setGradeCompleted] = useState<GradeCompleted>(defaultGrade);
  const [letterGrade, setLetterGrade] = useState<string>("A");

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleSubmit = () => {
    if (selectedCourseId == null) return;
    onSubmit({ courseId: selectedCourseId, gradeCompleted, letterGrade });
  };

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
          maxHeight: "calc(100vh - 48px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
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
            borderBottom: "1px solid var(--border-default)",
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
                color: "var(--text-primary)",
              }}
            >
              Mark a course as completed
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: "24px",
                color: "var(--text-muted)",
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
          <div
            style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <label
                htmlFor="completed-grade"
                style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: 600 }}
              >
                Grade completed:
              </label>
              <select
                id="completed-grade"
                value={gradeCompleted}
                onChange={(e) => setGradeCompleted(e.target.value as GradeCompleted)}
                style={{
                  padding: "8px 12px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                }}
              >
                {GRADE_COMPLETED_OPTIONS.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <label
                htmlFor="letter-grade"
                style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: 600 }}
              >
                Letter grade:
              </label>
              <select
                id="letter-grade"
                value={letterGrade}
                onChange={(e) => setLetterGrade(e.target.value)}
                style={{
                  padding: "8px 12px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                }}
              >
                {LETTER_GRADE_OPTIONS.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          <CoursePicker
            onSelect={setSelectedCourseId}
            excludeCourseIds={excludeCourseIds}
            selectedCourseId={selectedCourseId}
            actionLabel="Select"
            simple
          />
        </div>
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedCourseId == null}
            style={{
              padding: "10px 18px",
              fontSize: "15px",
              fontWeight: 500,
              color: "#FFFFFF",
              backgroundColor: selectedCourseId == null ? "var(--text-muted)" : "var(--brand-accent)",
              border: "none",
              borderRadius: "8px",
              cursor: selectedCourseId == null ? "not-allowed" : "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

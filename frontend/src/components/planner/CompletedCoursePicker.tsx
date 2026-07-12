"use client";

import React, { useEffect, useState } from "react";
import { CoursePicker } from "./CoursePicker";
import {
  GRADE_COMPLETED_OPTIONS,
  type GradeCompleted,
} from "@/lib/completedCourses";

const YEAR_COMPLETED_OPTIONS = [
  "2023-2024",
  "2024-2025",
  "2025-2026",
  "2026-2027",
] as const;

type CompletedCoursePickerProps = {
  onClose: () => void;
  onSubmit: (selection: {
    courseId: number;
    gradeCompleted: GradeCompleted;
    yearCompleted: string;
  }) => void;
  excludeCourseIds?: number[];
  defaultGrade?: GradeCompleted;
  defaultYear?: string;
};

export function CompletedCoursePicker({
  onClose,
  onSubmit,
  excludeCourseIds,
  defaultGrade = "Freshman (9)",
  defaultYear = "2025-2026",
}: CompletedCoursePickerProps): React.ReactElement {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [gradeCompleted, setGradeCompleted] = useState<GradeCompleted>(defaultGrade);
  const [yearCompleted, setYearCompleted] = useState<string>(defaultYear);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleSubmit = () => {
    if (selectedCourseId == null) return;
    onSubmit({ courseId: selectedCourseId, gradeCompleted, yearCompleted });
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
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
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
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              Mark a course as completed
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
          <div
            style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <label
                htmlFor="completed-grade"
                style={{ color: "#d1d5db", fontSize: "14px", fontWeight: 500 }}
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
                  color: "#ffffff",
                  backgroundColor: "#111827",
                  border: "1px solid #4b5563",
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
                htmlFor="completed-year"
                style={{ color: "#d1d5db", fontSize: "14px", fontWeight: 500 }}
              >
                Year completed:
              </label>
              <select
                id="completed-year"
                value={yearCompleted}
                onChange={(e) => setYearCompleted(e.target.value)}
                style={{
                  padding: "8px 12px",
                  fontSize: "14px",
                  color: "#ffffff",
                  backgroundColor: "#111827",
                  border: "1px solid #4b5563",
                  borderRadius: "8px",
                }}
              >
                {YEAR_COMPLETED_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {year}
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
            borderTop: "1px solid #374151",
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
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: selectedCourseId == null ? "#4b5563" : "#2563eb",
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

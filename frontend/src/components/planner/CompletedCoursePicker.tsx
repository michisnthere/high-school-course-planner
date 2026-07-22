"use client";

import React, { useEffect, useState } from "react";
import { CoursePicker } from "./CoursePicker";
import type { GradeCompleted } from "@/lib/completedCourses";
import { ACADEMIC_PERIODS } from "@/lib/completedCoursePeriods";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type CompletedCoursePickerProps = {
  onClose: () => void;
  onSubmit: (selection: {
    courseId: number;
    gradeCompleted: GradeCompleted;
  }) => void;
  excludeCourseIds?: number[];
  defaultGrade?: GradeCompleted;
};

export function CompletedCoursePicker({
  onClose,
  onSubmit,
  excludeCourseIds,
  defaultGrade = "Middle School",
}: CompletedCoursePickerProps): React.ReactElement {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [gradeCompleted, setGradeCompleted] = useState<GradeCompleted>(defaultGrade);
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleSubmit = () => {
    if (selectedCourseId == null) return;
    onSubmit({ courseId: selectedCourseId, gradeCompleted });
  };

  return (
    <>
      {isMobile && <style>{`
        @keyframes mob-sheet-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: isMobile ? "flex-end" : "center",
          justifyContent: "center",
          zIndex: 50,
          padding: isMobile ? 0 : "24px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "100%",
            maxWidth: isMobile ? "100%" : "600px",
            maxHeight: isMobile ? "100%" : "calc(100vh - 48px)",
            height: isMobile ? "100%" : "auto",
            backgroundColor: "var(--bg-card)",
            border: isMobile ? "none" : "1px solid var(--border-default)",
            borderRadius: isMobile ? 0 : "16px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: isMobile ? "mob-sheet-slide-up 0.25s ease-out" : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: isMobile ? "calc(72px + var(--safe-area-top, 0px)) 24px 16px" : "24px 24px 16px",
              borderBottom: "1px solid var(--border-default)",
              flexShrink: 0,
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
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  lineHeight: 1,
                  borderRadius: "8px",
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flex: isMobile ? "1 1 auto" : undefined }}>
              <label
                htmlFor="completed-grade"
                style={{ color: "var(--text-secondary)", fontSize: isMobile ? "13px" : "14px", fontWeight: 600, whiteSpace: "nowrap" }}
              >
                Grade Level:
              </label>
              <select
                id="completed-grade"
                value={gradeCompleted}
                onChange={(e) => setGradeCompleted(e.target.value as GradeCompleted)}
                style={{
                  padding: isMobile ? "10px 12px" : "8px 12px",
                  fontSize: isMobile ? "14px" : "14px",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  minHeight: isMobile ? "44px" : undefined,
                  flex: 1,
                }}
              >
                {ACADEMIC_PERIODS.map((period) => (
                  <option key={period.label} value={period.values[0]}>
                    {period.label}
                  </option>
                ))}
              </select>
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
              padding: isMobile ? "16px 24px calc(16px + var(--safe-area-bottom, 0px))" : "16px 24px",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "flex-end",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedCourseId == null}
              style={{
                padding: isMobile ? "12px 24px" : "10px 18px",
                fontSize: isMobile ? "16px" : "15px",
                fontWeight: 500,
                color: "#FFFFFF",
                backgroundColor: selectedCourseId == null ? "var(--text-muted)" : "var(--brand-accent)",
                border: "none",
                borderRadius: "8px",
                cursor: selectedCourseId == null ? "not-allowed" : "pointer",
                minHeight: isMobile ? "48px" : undefined,
                width: isMobile ? "100%" : undefined,
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

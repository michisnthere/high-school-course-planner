"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { Course } from "@/types/course";
import { useCompletedCoursesService } from "@/services/ServiceContext";
import { courseToPlannerDetails } from "@/lib/planner";
import { ACADEMIC_PERIODS } from "@/lib/completedCoursePeriods";
import type { GradeCompleted } from "@/lib/completedCourses";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type MarkCompletedButtonProps = {
  course: Course;
};

export function MarkCompletedButton({
  course,
}: MarkCompletedButtonProps): React.ReactElement {
  const completedService = useCompletedCoursesService();
  const { isMobile } = useBreakpoint();
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [grade, setGrade] = useState<GradeCompleted>("Middle School");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const completed = await completedService.getCompletedCourses();
      setCompletedIds(
        new Set(completed.map((c) => c.courseId).filter((id): id is number => id != null))
      );
    } catch {
      setCompletedIds(new Set());
    }
  }, [completedService]);

  useEffect(() => {
    load();
    const handler = () => {
      load();
    };
    window.addEventListener("completed-courses:changed", handler);
    return () => window.removeEventListener("completed-courses:changed", handler);
  }, [load]);

  const isCompleted = completedIds.has(course.id);

  const handleClick = () => {
    if (isCompleted) {
      window.location.href = "/completed";
      return;
    }
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await completedService.addCompletedCourse(course.id, grade, courseToPlannerDetails(course));
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark course as completed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={isCompleted}
        title={isCompleted ? "View completed courses" : undefined}
        style={{
          height: "36px",
          padding: "0 16px",
          fontSize: "14px",
          fontWeight: 500,
          color: isCompleted ? "#FFFFFF" : "var(--text-secondary)",
          backgroundColor: isCompleted ? "var(--brand-accent)" : "transparent",
          border: `1px solid ${isCompleted ? "var(--brand-accent)" : "var(--btn-secondary-border)"}`,
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        {isCompleted ? "Completed ✓" : "Mark as Completed"}
      </button>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mark as completed"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: isMobile ? 0 : "24px",
          }}
          onClick={() => {
            if (!loading) setModalOpen(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              maxHeight: "calc(100dvh - 48px)",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "16px",
              padding: isMobile ? "calc(56px + var(--safe-area-top, 0px)) 20px 20px" : "24px",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Mark as completed
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: "15px", color: "var(--text-secondary)" }}>
              {course.title}
            </p>

            <label
              htmlFor="catalog-completed-grade"
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Grade Level
            </label>
            <select
              id="catalog-completed-grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value as GradeCompleted)}
              style={{
                width: "100%",
                padding: isMobile ? "10px 12px" : "8px 12px",
                fontSize: "14px",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-input)",
                border: "1px solid var(--border-default)",
                borderRadius: "8px",
                minHeight: isMobile ? "44px" : undefined,
                marginBottom: "16px",
              }}
            >
              {ACADEMIC_PERIODS.map((period) => (
                <option key={period.label} value={period.values[0]}>
                  {period.label}
                </option>
              ))}
            </select>

            {error && (
              <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#ef4444" }}>{error}</p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={loading}
                style={{
                  padding: isMobile ? "12px 24px" : "10px 18px",
                  fontSize: isMobile ? "16px" : "15px",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  padding: isMobile ? "12px 24px" : "10px 18px",
                  fontSize: isMobile ? "16px" : "15px",
                  fontWeight: 500,
                  color: "#FFFFFF",
                  backgroundColor: "var(--brand-accent)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Saving…" : "Mark Completed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

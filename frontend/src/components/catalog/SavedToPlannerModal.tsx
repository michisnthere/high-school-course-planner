"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlannerService } from "@/services/ServiceContext";
import type { Planner } from "@/lib/planner";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type SavedToPlannerModalProps = {
  courseId: number;
  courseTitle: string;
  onClose: () => void;
};

const YEAR_OPTIONS = [
  { value: 9, label: "Freshman (Grade 9)" },
  { value: 10, label: "Sophomore (Grade 10)" },
  { value: 11, label: "Junior (Grade 11)" },
  { value: 12, label: "Senior (Grade 12)" },
];

const SEMESTER_OPTIONS = [
  { value: 1, label: "Semester 1" },
  { value: 2, label: "Semester 2" },
];

const SLOT_OPTIONS = Array.from({ length: 7 }, (_, i) => ({
  value: i + 1,
  label: `Slot ${i + 1}`,
}));

const selectStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "14px",
  color: "var(--text-primary)",
  backgroundColor: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "8px",
  cursor: "pointer",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "6px",
};

export function SavedToPlannerModal({
  courseId,
  courseTitle,
  onClose,
}: SavedToPlannerModalProps): React.ReactElement {
  const router = useRouter();
  const plannerService = usePlannerService();
  const { isMobile } = useBreakpoint();

  const [year, setYear] = useState(9);
  const [semester, setSemester] = useState(1);
  const [slot, setSlot] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [planners, setPlanners] = useState<Planner[]>([]);

  useEffect(() => {
    plannerService.getPlanners().then(setPlanners).catch(() => {});
  }, [plannerService]);

  const targetPlanner = useMemo(
    () => planners.find((p) => p.schoolYear === year),
    [planners, year]
  );

  const handleSubmit = useCallback(async () => {
    if (!targetPlanner) {
      setError("Planner not found for the selected year.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await plannerService.addPlannedCourse(
        targetPlanner.id,
        courseId,
        semester,
        slot
      );
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add course to planner");
    } finally {
      setLoading(false);
    }
  }, [plannerService, courseId, targetPlanner, semester, slot]);

  const handleGoToPlanner = useCallback(() => {
    router.push(`/planner/${year}`);
  }, [router, year]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
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
          maxWidth: isMobile ? "100%" : "480px",
          maxHeight: isMobile ? "100%" : "calc(100vh - 48px)",
          height: isMobile ? "100%" : "auto",
          backgroundColor: "var(--bg-card)",
          border: isMobile ? "none" : "1px solid var(--border-default)",
          borderRadius: isMobile ? 0 : "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: isMobile
              ? "calc(72px + var(--safe-area-top, 0px)) 24px 16px"
              : "24px 24px 16px",
            borderBottom: "1px solid var(--border-default)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Add to Planner
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
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--text-secondary)",
              lineHeight: 1.4,
            }}
          >
            {courseTitle}
          </p>
        </div>

        <div
          style={{
            padding: "20px 24px",
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {success ? (
            <div
              style={{
                padding: "16px",
                backgroundColor: "var(--status-success-bg, #ecfdf5)",
                border: "1px solid var(--status-success-border, #a7f3d0)",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--status-success, #059669)",
                }}
              >
                Course added to your planner!
              </p>
              <button
                type="button"
                onClick={handleGoToPlanner}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#FFFFFF",
                  backgroundColor: "var(--brand-accent)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Go to Planner
              </button>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="saved-planner-year" style={labelStyle}>
                  School Year
                </label>
                <select
                  id="saved-planner-year"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  style={selectStyle}
                >
                  {YEAR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="saved-planner-semester" style={labelStyle}>
                  Semester
                </label>
                <select
                  id="saved-planner-semester"
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  style={selectStyle}
                >
                  {SEMESTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="saved-planner-slot" style={labelStyle}>
                  Slot
                </label>
                <select
                  id="saved-planner-slot"
                  value={slot}
                  onChange={(e) => setSlot(Number(e.target.value))}
                  style={selectStyle}
                >
                  {SLOT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p
                  style={{
                    margin: 0,
                    padding: "10px 14px",
                    fontSize: "13px",
                    color: "var(--status-error, #dc2626)",
                    backgroundColor: "var(--status-error-bg, #fef2f2)",
                    border: "1px solid var(--status-error-border, #fecaca)",
                    borderRadius: "8px",
                    lineHeight: 1.4,
                  }}
                >
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {!success && (
          <div
            style={{
              padding: isMobile
                ? "16px 24px calc(16px + var(--safe-area-bottom, 0px))"
                : "16px 24px",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--text-secondary)",
                backgroundColor: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                padding: "10px 18px",
                fontSize: "14px",
                fontWeight: 500,
                color: "#FFFFFF",
                backgroundColor: loading ? "var(--text-muted)" : "var(--brand-accent)",
                border: "none",
                borderRadius: "8px",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Adding..." : "Add to Planner"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

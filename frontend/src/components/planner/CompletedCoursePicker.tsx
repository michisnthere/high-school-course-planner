"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CoursePicker } from "./CoursePicker";
import type { GradeCompleted } from "@/lib/completedCourses";
import {
  defaultGradeForContext,
  filterSummerCoursesByQuery,
  getAcademicPeriodLabel,
  gradeOptionsForContext,
} from "@/lib/completedCoursePeriods";
import { getSummerCourses, type SummerCourse } from "@/lib/summerCourse";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { pickerCardFrame, pickerCardPalette, pickerCardRadius, pickerSearchInputStyle } from "./pickerStyles";

export type CompletedCourseSelection =
  | { courseId: number; gradeCompleted: GradeCompleted }
  | { summerCourseId: number; gradeCompleted: GradeCompleted; summerCourse: SummerCourse };

type CompletedCoursePickerProps = {
  onClose: () => void;
  onSubmit: (selection: CompletedCourseSelection) => void;
  excludeCourseIds?: number[];
  excludeSummerCourseIds?: number[];
  defaultGrade?: GradeCompleted;
};

export function CompletedCoursePicker({
  onClose,
  onSubmit,
  excludeCourseIds,
  excludeSummerCourseIds,
  defaultGrade = "Middle School",
}: CompletedCoursePickerProps): React.ReactElement {
  const [tab, setTab] = useState<"regular" | "summer">("regular");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedSummer, setSelectedSummer] = useState<SummerCourse | null>(null);
  const [summerCourses, setSummerCourses] = useState<SummerCourse[]>([]);
  const [summerLoading, setSummerLoading] = useState(false);
  const [summerError, setSummerError] = useState<string | null>(null);
  const [gradeCompleted, setGradeCompleted] = useState<GradeCompleted>(defaultGrade);
  const [query, setQuery] = useState("");
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const loadSummerCourses = () => {
    setSummerLoading(true);
    getSummerCourses()
      .then(setSummerCourses)
      .catch(() => setSummerError("Failed to load Summer School courses."))
      .finally(() => setSummerLoading(false));
  };

  const handleSubmit = () => {
    if (selectedCourseId == null && selectedSummer == null) return;
    if (tab === "summer" && selectedSummer) {
      onSubmit({
        summerCourseId: selectedSummer.id,
        gradeCompleted,
        summerCourse: selectedSummer,
      });
      return;
    }
    if (selectedCourseId != null) {
      onSubmit({ courseId: selectedCourseId, gradeCompleted });
    }
  };

  const excludedSummerIds = new Set(excludeSummerCourseIds ?? []);

  // Live search over the Summer School list only; the regular list has its own
  // search and is never filtered by this query.
  const filteredSummerCourses = useMemo(
    () => filterSummerCoursesByQuery(summerCourses, query),
    [summerCourses, query]
  );

  // The grade options derive from the active tab's course context. The two
  // sets are mutually exclusive and the selected grade is reset when switching
  // contexts so a mixed value can never be carried across.
  const gradeOptions = gradeOptionsForContext(tab === "summer");

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
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              {(["regular", "summer"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setSelectedSummer(null);
                    setSelectedCourseId(null);
                    setQuery("");
                    setGradeCompleted(defaultGradeForContext(t === "summer", defaultGrade));
                    if (t === "summer") loadSummerCourses();
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: tab === t ? "#ffffff" : "var(--text-secondary)",
                    backgroundColor: tab === t ? "var(--brand-accent)" : "var(--bg-input)",
                    border: tab === t ? "1px solid var(--brand-accent)" : "1px solid var(--border-default)",
                    borderRadius: "9999px",
                    cursor: "pointer",
                  }}
                >
                  {t === "regular" ? "Regular Courses" : "Summer Courses"}
                </button>
              ))}
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
                {gradeOptions.map((option) => (
                  <option key={option} value={option}>
                    {getAcademicPeriodLabel(option)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {tab === "regular" ? (
              <CoursePicker
                onSelect={setSelectedCourseId}
                excludeCourseIds={excludeCourseIds}
                selectedCourseId={selectedCourseId}
                actionLabel="Select"
                simple
                tone="light"
              />
            ) : summerLoading ? (
              <div style={{ padding: "24px", color: "var(--text-muted)", fontSize: "14px" }}>
                Loading summer courses...
              </div>
            ) : summerError ? (
              <div style={{ padding: "24px", color: "var(--status-error)", fontSize: "14px" }}>
                {summerError}
              </div>
            ) : (
              <>
                <div style={{ padding: "0 24px 12px", flexShrink: 0 }}>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Search summer courses..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="rs-picker-search"
                      style={{ ...pickerSearchInputStyle, paddingRight: query ? "40px" : "16px", paddingLeft: "16px" }}
                      aria-label="Search summer courses"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        style={{
                          position: "absolute",
                          right: "4px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "36px",
                          height: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: pickerCardPalette.muted,
                          fontSize: "18px",
                          lineHeight: 1,
                          borderRadius: "50%",
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {filteredSummerCourses.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
                      {query.trim() !== ""
                        ? "No summer courses match your search."
                        : "No summer courses available."}
                    </p>
                  ) : (
                    filteredSummerCourses.map((sc) => {
                      const disabled = excludedSummerIds.has(sc.id);
                      const isFullSummer = sc.duration === "full_summer";
                      return (
                        <div
                          key={sc.id}
                          onClick={() => {
                            if (!disabled) setSelectedSummer(sc);
                          }}
                          style={{
                            padding: "12px 14px",
                            borderRadius: pickerCardRadius,
                            ...pickerCardFrame(selectedSummer?.id === sc.id),
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.5 : 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
                            <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word" }}>
                              {sc.title}
                            </span>
                            {sc.courseCode && (
                              <span style={{ fontSize: "12px", color: "var(--text-muted)", flex: "0 0 auto" }}>{sc.courseCode}</span>
                            )}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
                            {isFullSummer && <span>Full Summer</span>}
                            {(sc.sessions ?? []).length > 0 && <span>{(sc.sessions ?? []).join(" · ")}</span>}
                            {sc.credits != null && <span>{sc.credits} credits</span>}
                            {sc.fulfillsRequirements.length > 0 && (
                              <span>Fulfills: {sc.fulfillsRequirements.join(", ")}</span>
                            )}
                          </div>
                          {disabled && (
                            <span style={{ fontSize: "12px", color: "var(--status-error)" }}>
                              Already recorded as completed
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
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
              disabled={tab === "summer" ? selectedSummer == null : selectedCourseId == null}
              style={{
                padding: isMobile ? "12px 24px" : "10px 18px",
                fontSize: isMobile ? "16px" : "15px",
                fontWeight: 500,
                color: "#FFFFFF",
                backgroundColor:
                  (tab === "summer" ? selectedSummer == null : selectedCourseId == null)
                    ? "var(--text-muted)"
                    : "var(--brand-accent)",
                border: "none",
                borderRadius: "8px",
                cursor: (tab === "summer" ? selectedSummer == null : selectedCourseId == null) ? "not-allowed" : "pointer",
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
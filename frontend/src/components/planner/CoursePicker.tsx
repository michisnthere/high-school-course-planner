"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  courseToPlannerDetails,
  type PlannerCourseDetails,
  sortPickerCourses,
} from "@/lib/planner";
import { getCourses } from "@/lib/api";
import { formatCredits } from "@/lib/courseCredits";
import { formatCreditType } from "@/lib/catalog";
import { useSearchSubmit } from "@/hooks/useSearchSubmit";
import { CourseFilters, type ActiveFilters } from "@/components/catalog/CourseFilters";
import {
  pickerCardFrame,
  pickerCardHoverBorder,
  pickerCardPalette,
  pickerCardRadius,
  pickerSearchInputStyle,
} from "./pickerStyles";

const searchBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  height: "44px",
  padding: "0 20px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#FFFFFF",
  backgroundColor: "var(--brand-accent)",
  border: "none",
  borderRadius: "9999px",
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxSizing: "border-box",
};

type CoursePickerProps = {
  onSelect: (courseId: number) => void;
  isSaved?: (courseId: number) => boolean;
  actionLabel?: string;
  excludeCourseIds?: number[];
  selectedCourseId?: number | null;
  simple?: boolean;
  /** Visual tone. "dark" is the default planner tone; "light" is used when the
   * picker is embedded in the "Mark a course as completed" modal so the cards
   * match the Summer School cards in that modal. */
  tone?: "light" | "dark";
};

// Card palette per tone. The light tone reuses the shared light-gray picker
// palette so regular cards match the Summer School cards exactly. Search input
// colors are applied inline (dark) or via the shared pickerSearchInputStyle.
const TONE = {
  dark: {
    cardBorder: "#374151",
    cardBorderSelected: "#275D38",
    cardBg: "#111827",
    cardBgSelected: "#ffffff",
    title: "#ffffff",
    titleSelected: "#000000",
    meta: "#9ca3af",
    metaSelected: "#4b5563",
    chip: "#1f2937",
    action: "var(--brand-accent)",
    actionSelected: "#275D38",
  },
  light: {
    cardBorder: "var(--border-default)",
    cardBorderSelected: "var(--brand-accent)",
    cardBg: "var(--bg-input)",
    cardBgSelected: "var(--bg-hover, rgba(0,0,0,0.03))",
    title: pickerCardPalette.title,
    titleSelected: pickerCardPalette.title,
    meta: pickerCardPalette.meta,
    metaSelected: pickerCardPalette.meta,
    chip: pickerCardPalette.chip,
    action: pickerCardPalette.action,
    actionSelected: pickerCardPalette.selectedAction,
  },
} as const;

export function CoursePicker({
  onSelect,
  isSaved,
  actionLabel = "Select",
  excludeCourseIds,
  selectedCourseId,
  simple = false,
  tone = "dark",
}: CoursePickerProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [allCourses, setAllCourses] = useState<PlannerCourseDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ActiveFilters>({
    division: [],
    department: [],
    creditType: [],
    gradeLevel: [],
    semester: [],
    requirement: [],
  });

  const { draft, setDraft, submitted, hasChanged, submit, handleKeyDown, clearAll } = useSearchSubmit();

  useEffect(() => {
    setLoading(true);
    getCourses()
      .then((courses) => courses.map(courseToPlannerDetails))
      .then(setAllCourses)
      .catch(() => setAllCourses([]))
      .finally(() => setLoading(false));
  }, []);

  const searchIndex = useMemo(() => {
    const index = new Map<number, string>();
    for (const course of allCourses) {
      index.set(course.id, course.title.toLowerCase());
    }
    return index;
  }, [allCourses]);

  const divisions = useMemo(() => {
    const names = new Set<string>();
    for (const course of allCourses) {
      if (course.division) names.add(course.division);
    }
    return Array.from(names).sort();
  }, [allCourses]);

  const handleSearchSubmit = useCallback(() => {
    submit();
  }, [submit]);

  const handleClear = useCallback(() => {
    clearAll();
    inputRef.current?.focus();
  }, [clearAll]);

  const filtered = useMemo(() => {
    let result = allCourses;
    if (excludeCourseIds?.length) {
      const excludeSet = new Set(excludeCourseIds);
      result = result.filter((c) => !excludeSet.has(c.id));
    }
    if (!simple && filters.division.length > 0) {
      const selected = filters.division[0];
      result = result.filter((c) => c.division === selected);
    }
    const q = submitted.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => {
        const searchable = searchIndex.get(c.id);
        return searchable ? searchable.includes(q) : c.title.toLowerCase().includes(q);
      });
    }
    return sortPickerCourses(result);
  }, [allCourses, excludeCourseIds, simple, filters.division, submitted, searchIndex]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0 }}>
      <div style={{ padding: "0 24px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
          <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "stretch" }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by course title..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className={tone === "light" ? "rs-picker-search" : undefined}
              style={
                tone === "light"
                  ? { ...pickerSearchInputStyle, paddingRight: draft ? "40px" : "16px", paddingLeft: "16px" }
                  : {
                      flex: 1,
                      height: "44px",
                      padding: draft ? "0 40px 0 16px" : "0 16px",
                      fontSize: "16px",
                      color: "#ffffff",
                      backgroundColor: "#111827",
                      border: "1px solid #4b5563",
                      borderRadius: "9999px",
                      outline: "none",
                      boxSizing: "border-box",
                    }
              }
              aria-label="Search courses"
            />
            {draft && (
              <button
                type="button"
                onClick={handleClear}
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
                  color: tone === "light" ? pickerCardPalette.muted : "#9ca3af",
                  fontSize: "18px",
                  lineHeight: 1,
                  borderRadius: "50%",
                }}
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearchSubmit}
            disabled={!hasChanged}
            aria-label="Search"
            style={{
              ...searchBtnStyle,
              opacity: !hasChanged ? 0.5 : 1,
              cursor: !hasChanged ? "not-allowed" : "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Search
          </button>
        </div>
        {!simple && (
          <CourseFilters
            divisions={divisions}
            divisionDepartments={new Map()}
            departments={[]}
            creditTypes={[]}
            gradeLevels={[]}
            semesters={[]}
            filters={filters}
            onFilterChange={setFilters}
          />
        )}
      </div>

      <div style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto", padding: "0 24px 24px" }}>
        {loading ? (
          <p style={{ color: tone === "light" ? pickerCardPalette.muted : "#9ca3af", textAlign: "center" }}>Loading courses...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: tone === "light" ? pickerCardPalette.muted : "#9ca3af", textAlign: "center" }}>
            {submitted.trim() === "" && filters.division.length === 0
              ? "No courses available."
              : "No courses match your search."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.map((course) => {
              const selected = selectedCourseId === course.id;
              const frame = tone === "light" ? pickerCardFrame(selected) : undefined;
              return (
              <button
                key={course.id}
                type="button"
                onClick={() => onSelect(course.id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: tone === "light" ? "12px 14px" : "16px",
                  borderRadius: tone === "light" ? pickerCardRadius : "12px",
                  backgroundColor: tone === "light" ? frame?.backgroundColor : selected ? TONE.dark.cardBgSelected : TONE.dark.cardBg,
                  border: tone === "light" ? frame?.border : `2px solid ${selected ? TONE.dark.cardBorderSelected : TONE.dark.cardBorder}`,
                  cursor: "pointer",
                  textAlign: "left",
                  color: tone === "light" ? pickerCardPalette.title : selected ? TONE.dark.titleSelected : "inherit",
                  width: "100%",
                  transition: "border-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = tone === "light" ? pickerCardHoverBorder : "#4b5563";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = tone === "light" ? "var(--border-default)" : "#374151";
                  }
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: tone === "light" ? pickerCardPalette.title : selected ? TONE.dark.titleSelected : TONE.dark.title,
                      }}
                    >
                      {course.title}
                    </span>
                    {isSaved?.(course.id) && (
                      <span style={{ fontSize: "18px", color: "var(--brand-accent)" }} aria-label="Saved">
                        ★
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      fontSize: "13px",
                      color: tone === "light" ? pickerCardPalette.meta : selected ? TONE.dark.metaSelected : TONE.dark.meta,
                    }}
                  >
                    {course.creditType && (
                      <span
                        style={{
                          padding: "3px 8px",
                          backgroundColor: tone === "light" ? pickerCardPalette.chip : TONE.dark.chip,
                          borderRadius: "9999px",
                        }}
                      >
                        {formatCreditType(course.creditType, course.title)}
                      </span>
                    )}
                    {course.credits != null && (
                      <span
                        style={{
                          padding: "3px 8px",
                          backgroundColor: tone === "light" ? pickerCardPalette.chip : TONE.dark.chip,
                          borderRadius: "9999px",
                        }}
                      >
                        {formatCredits(course.credits)} credits
                      </span>
                    )}
                    {course.duration === 2 && (
                      <span
                        style={{
                          padding: "3px 8px",
                          backgroundColor: tone === "light" ? pickerCardPalette.chip : TONE.dark.chip,
                          borderRadius: "9999px",
                        }}
                      >
                        Full Year
                      </span>
                    )}
                    {course.duration === 1 && (
                      <span
                        style={{
                          padding: "3px 8px",
                          backgroundColor: tone === "light" ? pickerCardPalette.chip : TONE.dark.chip,
                          borderRadius: "9999px",
                        }}
                      >
                        One Semester
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {selected && (
                    <span style={{ fontSize: "16px", color: tone === "light" ? pickerCardPalette.selectedAction : "#275D38" }}>✓</span>
                  )}
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: selected
                        ? tone === "light" ? pickerCardPalette.selectedAction : TONE.dark.actionSelected
                        : pickerCardPalette.action,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selected ? "Selected" : actionLabel}
                  </span>
                </div>
              </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

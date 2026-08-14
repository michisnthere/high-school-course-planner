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
import { pickerCardPalette, pickerSearchInputStyle } from "./pickerStyles";
import { PickerCourseCard } from "./PickerCourseCard";

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

// The regular course card now lives in the shared PickerCourseCard component
// (light tone for the "Mark a course as completed" modal, dark tone for the
// planner's "Add a Course" modal). Search input colors are applied inline
// (dark) or via the shared pickerSearchInputStyle.

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
              const tags: string[] = [];
              if (course.creditType) {
                const creditType = formatCreditType(course.creditType, course.title);
                if (creditType) tags.push(creditType);
              }
              if (course.credits != null) tags.push(`${formatCredits(course.credits)} credits`);
              if (course.duration === 2) tags.push("Full Year");
              if (course.duration === 1) tags.push("One Semester");
              return (
                <PickerCourseCard
                  key={course.id}
                  title={course.title}
                  tags={tags}
                  selected={selectedCourseId === course.id}
                  onSelect={() => onSelect(course.id)}
                  actionLabel={actionLabel}
                  isSaved={isSaved?.(course.id) ?? false}
                  tone={tone}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

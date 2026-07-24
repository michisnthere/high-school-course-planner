"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  courseToPlannerDetails,
  type PlannerCourseDetails,
  sortPickerCourses,
} from "@/lib/planner";
import { getCourses } from "@/lib/api";
import { formatCreditType } from "@/lib/catalog";
import { CourseFilters, type ActiveFilters } from "@/components/catalog/CourseFilters";

type CoursePickerProps = {
  onSelect: (courseId: number) => void;
  isSaved?: (courseId: number) => boolean;
  actionLabel?: string;
  excludeCourseIds?: number[];
  selectedCourseId?: number | null;
  simple?: boolean;
};

export function CoursePicker({
  onSelect,
  isSaved,
  actionLabel = "Select",
  excludeCourseIds,
  selectedCourseId,
  simple = false,
}: CoursePickerProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const isComposingRef = useRef(false);
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
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => {
        const searchable = searchIndex.get(c.id);
        return searchable ? searchable.includes(q) : c.title.toLowerCase().includes(q);
      });
    }
    return sortPickerCourses(result);
  }, [allCourses, excludeCourseIds, simple, filters.division, query, searchIndex]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "0 24px 16px" }}>
        <input
          type="text"
          placeholder="Search by course title..."
          value={query}
          onChange={(e) => {
            if (isComposingRef.current) return;
            setQuery(e.target.value);
          }}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            setQuery((e.target as HTMLInputElement).value);
          }}
          autoFocus
          style={{
            width: "100%",
            padding: "14px 16px",
            fontSize: "16px",
            color: "#ffffff",
            backgroundColor: "#111827",
            border: "1px solid #4b5563",
            borderRadius: "10px",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: "16px",
          }}
        />
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

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
        {loading ? (
          <p style={{ color: "#9ca3af", textAlign: "center" }}>Loading courses...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "#9ca3af", textAlign: "center" }}>
            {query.trim() === "" && filters.division.length === 0
              ? "No courses available."
              : "No courses match your search."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => onSelect(course.id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "16px",
                  backgroundColor: selectedCourseId === course.id ? "#ffffff" : "#111827",
                  border: `2px solid ${selectedCourseId === course.id ? "#275D38" : "#374151"}`,
                  borderRadius: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  color: selectedCourseId === course.id ? "#000000" : "inherit",
                  width: "100%",
                  transition: "border-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (selectedCourseId !== course.id) {
                    e.currentTarget.style.borderColor = "#4b5563";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCourseId !== course.id) {
                    e.currentTarget.style.borderColor = "#374151";
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
                        color: selectedCourseId === course.id ? "#000000" : "#ffffff",
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
                      color: selectedCourseId === course.id ? "#4b5563" : "#9ca3af",
                    }}
                  >
                    {course.creditType && (
                      <span
                        style={{
                          padding: "3px 8px",
                          backgroundColor: "#1f2937",
                          borderRadius: "9999px",
                        }}
                      >
                        {formatCreditType(course.creditType)}
                      </span>
                    )}
                    {course.credits != null && (
                      <span
                        style={{
                          padding: "3px 8px",
                          backgroundColor: "#1f2937",
                          borderRadius: "9999px",
                        }}
                      >
                        {course.credits} credits
                      </span>
                    )}
                    {course.duration === 2 && (
                      <span
                        style={{
                          padding: "3px 8px",
                          backgroundColor: "#1f2937",
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
                          backgroundColor: "#1f2937",
                          borderRadius: "9999px",
                        }}
                      >
                        One Semester
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {selectedCourseId === course.id && (
                    <span style={{ fontSize: "16px", color: "#275D38" }}>✓</span>
                  )}
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: selectedCourseId === course.id ? "#275D38" : "var(--brand-accent)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selectedCourseId === course.id ? "Selected" : actionLabel}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

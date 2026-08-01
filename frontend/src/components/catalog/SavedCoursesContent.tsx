"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";
import { formatCreditType } from "@/lib/catalog";
import { useSavedCourses } from "@/hooks/useSavedCourses";
import { useSearchSubmit } from "@/hooks/useSearchSubmit";
import { breakpoints } from "@/lib/responsive";
import { GuestEmptyState } from "@/components/auth/GuestEmptyState";

type SavedCoursesContentProps = {
  courses: Course[];
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  padding: "20px",
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: "18px",
  fontWeight: 700,
  color: "var(--text-primary)",
  lineHeight: 1.3,
  textDecoration: "none",
};

const badgeStyle: React.CSSProperties = {
  padding: "4px 10px",
  backgroundColor: "var(--brand-accent-light)",
  borderRadius: "9999px",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

const viewLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  padding: "8px 16px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#FFFFFF",
  backgroundColor: "var(--brand-accent)",
  borderRadius: "8px",
  textDecoration: "none",
  boxSizing: "border-box",
};

const removeButtonStyle: React.CSSProperties = {
  minHeight: "44px",
  padding: "8px 16px",
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--btn-danger-text)",
  backgroundColor: "transparent",
  border: "1px solid var(--btn-danger-border)",
  borderRadius: "8px",
  cursor: "pointer",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "14px",
  color: "var(--text-primary)",
  backgroundColor: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "8px",
  cursor: "pointer",
  outline: "none",
};

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

const SORT_OPTIONS = [
  "Recently Saved",
  "Alphabetical (A–Z)",
  "Department",
  "Grade Availability",
];

function getCourseCode(course: Course): string | null {
  const codes = course.options?.flatMap(
    (option) => option.offerings?.map((o) => o.courseCode) ?? []
  ) ?? [];
  const valid = codes.filter((c): c is string => typeof c === "string" && c.length > 0);
  return valid.length > 0 ? valid.sort()[0] : null;
}

function getMinGrade(course: Course): number {
  let min = Infinity;
  for (const option of course.options ?? []) {
    for (const offering of option.offerings ?? []) {
      if (offering.gradeMin != null && offering.gradeMin < min) min = offering.gradeMin;
    }
  }
  return Number.isFinite(min) ? min : 9;
}

export function SavedCoursesContent({
  courses,
}: SavedCoursesContentProps): React.ReactElement {
  const { savedIds, loading, isAuthenticated, toggle } = useSavedCourses();
  const searchParams = useSearchParams();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [department, setDepartment] = useState(() => searchParams.get("dept") ?? "All Departments");
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? "Recently Saved");
  const { draft, setDraft, submitted, hasChanged, submit, handleKeyDown, clearAll } = useSearchSubmit(
    searchParams.get("q") ?? ""
  );

  const syncUrl = useCallback((q: string, dept: string, s: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (dept && dept !== "All Departments") params.set("dept", dept);
    if (s && s !== "Recently Saved") params.set("sort", s);
    const str = params.toString();
    router.replace(`/saved${str ? `?${str}` : ""}`, { scroll: false });
  }, [router]);

  const handleSearchSubmit = useCallback(() => {
    submit();
    syncUrl(draft, department, sort);
  }, [draft, department, sort, submit, syncUrl]);

  const handleClear = useCallback(() => {
    clearAll();
    syncUrl("", department, sort);
    inputRef.current?.focus();
  }, [clearAll, department, sort, syncUrl]);

  const handleDepartmentChange = useCallback((value: string) => {
    setDepartment(value);
    syncUrl(submitted, value, sort);
  }, [syncUrl, submitted, sort]);

  const handleSortChange = useCallback((value: string) => {
    setSort(value);
    syncUrl(submitted, department, value);
  }, [syncUrl, submitted, department]);

  const courseMap = useMemo(() => {
    const map = new Map<number, Course>();
    for (const course of courses) {
      map.set(course.id, course);
    }
    return map;
  }, [courses]);

  const savedCourses = useMemo(() => {
    return savedIds.map((id) => courseMap.get(id)).filter((c): c is Course => c != null);
  }, [savedIds, courseMap]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    for (const course of savedCourses) {
      if (course.department?.name) depts.add(course.department.name);
    }
    return Array.from(depts).sort();
  }, [savedCourses]);

  const filtered = useMemo(() => {
    let results = savedCourses;

    if (department !== "All Departments") {
      results = results.filter((c) => c.department?.name === department);
    }

    if (submitted.trim()) {
      const q = submitted.toLowerCase().trim();
      results = results.filter((c) => {
        const code = getCourseCode(c);
        return c.title.toLowerCase().includes(q) || (code != null && code.toLowerCase().includes(q));
      });
    }

    const sorted = [...results];
    switch (sort) {
      case "Alphabetical (A–Z)":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "Department":
        sorted.sort((a, b) => {
          const deptA = a.department?.name ?? "";
          const deptB = b.department?.name ?? "";
          if (deptA !== deptB) return deptA.localeCompare(deptB);
          return a.title.localeCompare(b.title);
        });
        break;
      case "Grade Availability":
        sorted.sort((a, b) => {
          const gradeA = getMinGrade(a);
          const gradeB = getMinGrade(b);
          if (gradeA !== gradeB) return gradeA - gradeB;
          return a.title.localeCompare(b.title);
        });
        break;
      case "Recently Saved":
      default:
        break;
    }

    return sorted;
  }, [savedCourses, department, submitted, sort]);

  if (!isAuthenticated) {
    return (
      <GuestEmptyState
        title="Saved Courses"
        description="Sign in to save interesting courses and review them later. Your saved courses will be stored securely and synced across devices."
      />
    );
  }

  return (
    <div className="rs-saved-page" style={{ padding: "32px" }}>
      <h1
        style={{
          margin: "0 0 20px",
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        Saved Courses
      </h1>
      {loading ? (
        <p
          style={{
            margin: 0,
            fontSize: "16px",
            color: "var(--text-muted)",
          }}
        >
          Loading saved courses...
        </p>
      ) : savedCourses.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "16px",
            color: "var(--text-muted)",
          }}
        >
          No saved courses yet.
        </p>
      ) : (
        <>
      <style>{`
        .sc-toolbar {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          align-items: stretch;
        }
        .sc-search-wrap {
          flex: 1;
          min-width: 200px;
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .sc-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
        .sc-filter-label {
          display: none;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
        }
        .sc-select {
          min-width: 200px;
        }
        .sc-search {
          flex: 1;
          height: 44px;
          padding: 0 40px 0 14px;
          font-size: 14px;
          color: var(--text-primary);
          background-color: var(--bg-input);
          border: 1px solid var(--border-default);
          border-radius: 9999px;
          outline: none;
          box-sizing: border-box;
        }
        .sc-search::placeholder {
          color: var(--text-muted);
        }
        .sc-search-clear {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 18px;
          line-height: 1;
          border-radius: 50%;
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .sc-toolbar {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
            margin-bottom: 28px;
          }
          .sc-search-wrap {
            min-width: 0;
          }
          .sc-filters {
            width: 100%;
            gap: 10px;
          }
          .sc-filter-label {
            display: inline-block;
          }
          .sc-select {
            min-width: 0;
            flex: 1 1 160px;
            min-height: 44px;
            width: auto;
          }
        }
      `}</style>

      <div className="sc-toolbar">
        <div className="sc-search-wrap">
          <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "stretch" }}>
            <input
              ref={inputRef}
              type="text"
              className="sc-search"
              placeholder="Search by title or course code..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Search saved courses"
            />
            {draft && (
              <button
                type="button"
                className="sc-search-clear"
                onClick={handleClear}
                aria-label="Clear search"
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
        <div className="sc-filters">
          <select
            className="sc-select"
            value={department}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            style={selectStyle}
            aria-label="Filter by department"
          >
            <option value="All Departments">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <label htmlFor="saved-sort-select" className="sc-filter-label">
            Sort by:
          </label>
          <select
            id="saved-sort-select"
            className="sc-select"
            value={sort}
            onChange={(e) => handleSortChange(e.target.value)}
            style={selectStyle}
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            backgroundColor: "var(--bg-card)",
            borderRadius: "12px",
            border: "1px solid var(--border-default)",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            No matches found
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--text-muted)",
            }}
          >
            {submitted.trim() && department !== "All Departments"
              ? "Try adjusting your search or department filter."
              : submitted.trim()
              ? "Try a different search term."
              : "Try selecting a different department."}
          </p>
        </div>
      ) : (
        <div
          className="rs-saved-grid"
          style={{
            display: "grid",
            gap: "24px",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {filtered.map((course) => {
            const slug = getCourseSlug(course);
            const creditType = course.options?.[0]?.creditType ?? null;
            const returnParams = new URLSearchParams();
            if (submitted) returnParams.set("q", submitted);
            if (department !== "All Departments") returnParams.set("dept", department);
            if (sort !== "Recently Saved") returnParams.set("sort", sort);
            const returnStr = returnParams.toString();
            const courseUrl = `/catalog/${slug}?return=${encodeURIComponent(`/saved${returnStr ? `?${returnStr}` : ""}`)}`;

            return (
              <div key={slug} style={cardStyle}>
                <Link href={courseUrl} style={{ textDecoration: "none" }}>
                  <h3 style={titleStyle}>{course.title}</h3>
                </Link>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "16px",
                  }}
                >
                  {course.department?.name && (
                    <span style={badgeStyle}>{course.department.name}</span>
                  )}
                  {creditType && <span style={badgeStyle}>{formatCreditType(creditType)}</span>}
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <Link href={courseUrl} style={viewLinkStyle}>
                    View Course
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(course.id)}
                    style={removeButtonStyle}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}

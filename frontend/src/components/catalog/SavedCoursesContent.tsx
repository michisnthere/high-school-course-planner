"use client";

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";
import { formatCreditType } from "@/lib/catalog";
import { useSavedCourses } from "@/hooks/useSavedCourses";
import { breakpoints } from "@/lib/responsive";

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

const signInButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  padding: "8px 20px",
  fontSize: "15px",
  fontWeight: 500,
  color: "#FFFFFF",
  backgroundColor: "var(--brand-accent)",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  textDecoration: "none",
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
  minWidth: "200px",
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

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [department, setDepartment] = useState(() => searchParams.get("dept") ?? "All Departments");
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? "Recently Saved");

  const syncUrl = useCallback((q: string, dept: string, s: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (dept && dept !== "All Departments") params.set("dept", dept);
    if (s && s !== "Recently Saved") params.set("sort", s);
    const str = params.toString();
    router.replace(`/saved${str ? `?${str}` : ""}`, { scroll: false });
  }, [router]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    syncUrl(value, department, sort);
  }, [syncUrl, department, sort]);

  const handleDepartmentChange = useCallback((value: string) => {
    setDepartment(value);
    syncUrl(query, value, sort);
  }, [syncUrl, query, sort]);

  const handleSortChange = useCallback((value: string) => {
    setSort(value);
    syncUrl(query, department, value);
  }, [syncUrl, query, department]);

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

    if (query.trim()) {
      const q = query.toLowerCase().trim();
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
  }, [savedCourses, department, query, sort]);

  if (!isAuthenticated) {
    return (
      <div
        style={{
          padding: "24px",
          backgroundColor: "var(--bg-card)",
          borderRadius: "12px",
        }}
      >
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Sign in to save courses for later.
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "15px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Your saved courses will be stored securely and synced across devices.
        </p>
        <a href="/login" style={signInButtonStyle}>
          Sign In
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: "16px",
          color: "var(--text-muted)",
        }}
      >
        Loading saved courses...
      </p>
    );
  }

  if (savedCourses.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: "16px",
          color: "var(--text-muted)",
        }}
      >
        No saved courses yet.
      </p>
    );
  }

  return (
    <>
      <style>{`
        .sc-toolbar {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          align-items: center;
        }
        .sc-search {
          flex: 1;
          min-width: 200px;
          padding: 10px 14px;
          font-size: 14px;
          color: var(--text-primary);
          background-color: var(--bg-input);
          border: 1px solid var(--border-default);
          border-radius: 8px;
          outline: none;
          box-sizing: border-box;
        }
        .sc-search::placeholder {
          color: var(--text-muted);
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .sc-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .sc-search {
            min-width: 0;
          }
          .sc-select {
            width: 100%;
          }
        }
      `}</style>

      <div className="sc-toolbar">
        <input
          type="text"
          className="sc-search"
          placeholder="Search by title or course code..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
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
        <select
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
            {query.trim() && department !== "All Departments"
              ? "Try adjusting your search or department filter."
              : query.trim()
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
            if (query) returnParams.set("q", query);
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
  );
}
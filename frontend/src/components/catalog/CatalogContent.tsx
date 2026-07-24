"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Course } from "@/types/course";
import {
  sortCoursesByPrerequisites,
  courseMatchesQuery,
  extractDivisionsFromItems,
} from "@/lib/catalog";
import { CourseSearch } from "./CourseSearch";
import { CourseFilters, type ActiveFilters } from "./CourseFilters";
import { CourseGrid } from "./CourseGrid";
import { EmptyState } from "./EmptyState";

type CatalogContentProps = {
  courses: Course[];
};

function extractDivisionDepartments(courses: Course[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const course of courses) {
    const division = course.department?.division?.name;
    const department = course.department?.name;
    if (!division || !department) continue;
    if (!map.has(division)) {
      map.set(division, new Set<string>());
    }
    map.get(division)!.add(department);
  }

  const result = new Map<string, string[]>();
  for (const [division, departments] of map.entries()) {
    result.set(division, Array.from(departments).sort());
  }
  return result;
}

function extractDepartments(courses: Course[]): string[] {
  const departments = new Set<string>();
  for (const course of courses) {
    if (course.department?.name) {
      departments.add(course.department.name);
    }
  }
  return Array.from(departments).sort();
}

function extractCreditTypes(courses: Course[]): string[] {
  const creditTypes = new Set<string>();
  for (const course of courses) {
    for (const option of course.options ?? []) {
      if (option.creditType) {
        creditTypes.add(option.creditType);
      }
    }
  }
  return Array.from(creditTypes).sort();
}

function extractGradeLevels(courses: Course[]): number[] {
  const grades = new Set<number>();
  for (const course of courses) {
    for (const option of course.options ?? []) {
      for (const offering of option.offerings ?? []) {
        const min = offering.gradeMin ?? 9;
        const max = offering.gradeMax ?? 12;
        if (offering.gradeMin != null || offering.gradeMax != null) {
          for (let g = min; g <= max; g++) {
            grades.add(g);
          }
        }
      }
    }
  }
  return Array.from(grades).sort((a, b) => a - b);
}

function extractSemesters(courses: Course[]): string[] {
  const semesters = new Set<string>();
  for (const course of courses) {
    for (const option of course.options ?? []) {
      for (const offering of option.offerings ?? []) {
        const value = offering.semesterLabel ?? offering.duration;
        if (value) {
          semesters.add(value);
        }
      }
    }
  }
  return Array.from(semesters).sort();
}

function courseMatchesFilters(course: Course, filters: ActiveFilters): boolean {
  if (filters.requirement.length > 0) {
    const fulfills = course.fulfillsRequirements ?? [];
    const matches = filters.requirement.some((req) => fulfills.includes(req));
    if (!matches) return false;
  }

  if (filters.division.length > 0) {
    const courseDivision = course.department?.division?.name;
    if (!courseDivision || !filters.division.includes(courseDivision)) {
      return false;
    }
  }

  if (filters.department.length > 0) {
    if (!course.department?.name || !filters.department.includes(course.department.name)) {
      return false;
    }
  }

  if (filters.creditType.length > 0) {
    const hasCreditType = course.options?.some(
      (option) => option.creditType && filters.creditType.includes(option.creditType)
    );
    if (!hasCreditType) return false;
  }

  if (filters.gradeLevel.length > 0) {
    const selectedGrades = filters.gradeLevel.map((grade) => parseInt(grade, 10));
    const hasGrade = course.options?.some((option) =>
      option.offerings?.some((offering) => {
        if (offering.gradeMin == null && offering.gradeMax == null) {
          return false;
        }
        const min = offering.gradeMin ?? 9;
        const max = offering.gradeMax ?? 12;
        return selectedGrades.some((grade) => grade >= min && grade <= max);
      })
    );
    if (!hasGrade) return false;
  }

  if (filters.semester.length > 0) {
    const hasSemester = course.options?.some((option) =>
      option.offerings?.some((offering) => {
        const value = offering.semesterLabel ?? offering.duration ?? "";
        return filters.semester.includes(value);
      })
    );
    if (!hasSemester) return false;
  }

  return true;
}

function getEmptyStateMessage(query: string, filters: ActiveFilters): string {
  const hasQuery = query.trim().length > 0;
  const hasFilters = Object.values(filters).some((values) => values.length > 0);

  if (hasQuery && hasFilters) {
    return "No courses match your search and filters.";
  }
  if (hasQuery) {
    return "No courses match your search.";
  }
  if (hasFilters) {
    return "No courses match your filters.";
  }
  return "No courses found.";
}

function parseSearchParams(sp: URLSearchParams): { query: string; filters: ActiveFilters } {
  return {
    query: sp.get("q") || "",
    filters: {
      division: sp.getAll("division"),
      department: sp.getAll("department"),
      creditType: sp.getAll("creditType"),
      gradeLevel: sp.getAll("gradeLevel"),
      semester: sp.getAll("semester"),
      requirement: sp.getAll("requirement"),
    },
  };
}

function buildSearchParams(query: string, filters: ActiveFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  for (const v of filters.division) params.append("division", v);
  for (const v of filters.department) params.append("department", v);
  for (const v of filters.creditType) params.append("creditType", v);
  for (const v of filters.gradeLevel) params.append("gradeLevel", v);
  for (const v of filters.semester) params.append("semester", v);
  for (const v of filters.requirement) params.append("requirement", v);
  return params;
}

export function CatalogContent({ courses }: CatalogContentProps): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { query, filters } = useMemo(
    () => parseSearchParams(searchParams),
    [searchParams]
  );

  const [searchInput, setSearchInput] = useState(query);

  // Sync URL changes (back/forward) back to local input
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // Debounce URL sync only — filtering is synchronous
  const debouncePendingRef = useRef(false);

  useEffect(() => {
    if (searchInput === query) return;
    debouncePendingRef.current = true;
    const timer = setTimeout(() => {
      debouncePendingRef.current = false;
      const params = buildSearchParams(searchInput, filters);
      const target = params.toString() ? `/catalog?${params.toString()}` : "/catalog";
      router.replace(target, { scroll: false });
    }, 150);
    return () => {
      clearTimeout(timer);
    };
  }, [searchInput, filters, router, query]);

  // Stable ref for setFilters to always read the latest searchInput
  const searchInputRef = useRef(searchInput);
  searchInputRef.current = searchInput;

  const setFilters = useCallback(
    (newFilters: ActiveFilters) => {
      const params = buildSearchParams(searchInputRef.current, newFilters);
      const target = params.toString() ? `/catalog?${params.toString()}` : "/catalog";
      router.replace(target, { scroll: false });
    },
    [router]
  );

  const handleQueryChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const divisions = useMemo(
    () => extractDivisionsFromItems(courses, (course) => course.department?.division?.name),
    [courses]
  );
  const divisionDepartments = useMemo(() => extractDivisionDepartments(courses), [courses]);
  const departments = useMemo(() => extractDepartments(courses), [courses]);
  const creditTypes = useMemo(() => extractCreditTypes(courses), [courses]);
  const gradeLevels = useMemo(() => extractGradeLevels(courses), [courses]);
  const semesters = useMemo(() => extractSemesters(courses), [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter(
      (course) =>
        courseMatchesQuery(course, searchInput) && courseMatchesFilters(course, filters)
    );
  }, [courses, searchInput, filters]);

  const sortedCourses = useMemo(() => {
    return sortCoursesByPrerequisites(filteredCourses);
  }, [filteredCourses]);

  return (
    <>
      <CourseSearch query={searchInput} onQueryChange={handleQueryChange} />
      <CourseFilters
        divisions={divisions}
        divisionDepartments={divisionDepartments}
        departments={departments}
        creditTypes={creditTypes}
        gradeLevels={gradeLevels}
        semesters={semesters}
        filters={filters}
        onFilterChange={setFilters}
      />

      {sortedCourses.length === 0 ? (
        <EmptyState message={getEmptyStateMessage(searchInput, filters)} />
      ) : (
        <CourseGrid courses={sortedCourses} />
      )}
    </>
  );
}

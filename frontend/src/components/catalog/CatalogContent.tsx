"use client";

import React, { useMemo, useState } from "react";
import type { Course } from "@/types/course";
import { CourseSearch } from "./CourseSearch";
import { CourseFilters, type ActiveFilters } from "./CourseFilters";
import { CourseGrid } from "./CourseGrid";
import { EmptyState } from "./EmptyState";

type CatalogContentProps = {
  courses: Course[];
};

function courseMatchesQuery(course: Course, query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return true;
  return course.title.toLowerCase().includes(normalizedQuery);
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
  if (filters.department && course.department?.name !== filters.department) {
    return false;
  }

  if (filters.creditType) {
    const hasCreditType = course.options?.some(
      (option) => option.creditType === filters.creditType
    );
    if (!hasCreditType) return false;
  }

  if (filters.gradeLevel) {
    const selectedGrade = parseInt(filters.gradeLevel, 10);
    const hasGrade = course.options?.some((option) =>
      option.offerings?.some((offering) => {
        if (offering.gradeMin == null && offering.gradeMax == null) {
          return false;
        }
        const min = offering.gradeMin ?? 9;
        const max = offering.gradeMax ?? 12;
        return selectedGrade >= min && selectedGrade <= max;
      })
    );
    if (!hasGrade) return false;
  }

  if (filters.semester) {
    const hasSemester = course.options?.some((option) =>
      option.offerings?.some((offering) => {
        const value = offering.semesterLabel ?? offering.duration ?? "";
        return value === filters.semester;
      })
    );
    if (!hasSemester) return false;
  }

  return true;
}

function getEmptyStateMessage(query: string, filters: ActiveFilters): string {
  const hasQuery = query.trim().length > 0;
  const hasFilters = Object.values(filters).some(Boolean);

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

export function CatalogContent({ courses }: CatalogContentProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ActiveFilters>({
    department: "",
    creditType: "",
    gradeLevel: "",
    semester: "",
  });

  const departments = useMemo(() => extractDepartments(courses), [courses]);
  const creditTypes = useMemo(() => extractCreditTypes(courses), [courses]);
  const gradeLevels = useMemo(() => extractGradeLevels(courses), [courses]);
  const semesters = useMemo(() => extractSemesters(courses), [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter(
      (course) =>
        courseMatchesQuery(course, query) && courseMatchesFilters(course, filters)
    );
  }, [courses, query, filters]);

  return (
    <>
      <CourseSearch query={query} onQueryChange={setQuery} />
      <CourseFilters
        departments={departments}
        creditTypes={creditTypes}
        gradeLevels={gradeLevels}
        semesters={semesters}
        filters={filters}
        onFilterChange={setFilters}
      />

      {filteredCourses.length === 0 ? (
        <EmptyState message={getEmptyStateMessage(query, filters)} />
      ) : (
        <CourseGrid courses={filteredCourses} />
      )}
    </>
  );
}

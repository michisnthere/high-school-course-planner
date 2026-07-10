"use client";

import React, { useMemo, useState } from "react";
import type { Course } from "@/types/course";
import { sortAndGroupCourses } from "@/lib/catalog";
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

export function CatalogContent({ courses }: CatalogContentProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ActiveFilters>({
    department: [],
    creditType: [],
    gradeLevel: [],
    semester: [],
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

  const groupedCourses = useMemo(() => {
    return sortAndGroupCourses(filteredCourses);
  }, [filteredCourses]);

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
        <CourseGrid groupedCourses={groupedCourses} />
      )}
    </>
  );
}

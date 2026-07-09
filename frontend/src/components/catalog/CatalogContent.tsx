"use client";

import React, { useMemo, useState } from "react";
import type { Course } from "@/types/course";
import { CourseSearch } from "./CourseSearch";
import { CourseFilters } from "./CourseFilters";
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

export function CatalogContent({ courses }: CatalogContentProps): React.ReactElement {
  const [query, setQuery] = useState("");

  const filteredCourses = useMemo(() => {
    if (!query.trim()) return courses;
    return courses.filter((course) => courseMatchesQuery(course, query));
  }, [courses, query]);

  return (
    <>
      <CourseSearch query={query} onQueryChange={setQuery} />
      <CourseFilters />

      {filteredCourses.length === 0 ? (
        <EmptyState message="No courses match your search." />
      ) : (
        <CourseGrid courses={filteredCourses} />
      )}
    </>
  );
}

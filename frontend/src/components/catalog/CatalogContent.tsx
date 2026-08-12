"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Course } from "@/types/course";
import type { SummerCourse } from "@/lib/summerCourse";
import { getSummerCourses } from "@/lib/summerCourse";
import {
  buildCourseSortData,
  buildCourseSearchIndex,
  sortCoursesByPrerequisites,
  courseMatchesQuery,
  extractDivisionsFromItems,
} from "@/lib/catalog";
import { useSearchSubmit } from "@/hooks/useSearchSubmit";
import { CourseSearch } from "./CourseSearch";
import { CourseFilters, type ActiveFilters } from "./CourseFilters";
import { CourseGrid } from "./CourseGrid";
import { EmptyState } from "./EmptyState";
import { formatCredits } from "@/lib/courseCredits";

type CatalogContentProps = {
  courses: Course[];
};

type CatalogSource = "regular" | "summer";

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

function deriveSummerDivision(course: SummerCourse): string {
  const regularDivision = course.regularCourse?.division;
  if (regularDivision) return regularDivision;
  const requirements = course.fulfillsRequirements.map((r) => r.toLowerCase());
  if (requirements.some((r) => r.includes("english") || r.includes("communication"))) return "Communication Arts";
  if (requirements.some((r) => r.includes("fine arts") || r.includes("art") || r.includes("music"))) return "Fine Arts";
  if (requirements.some((r) => r.includes("mathematics") || r.includes("math"))) return "Mathematics";
  if (requirements.some((r) => r.includes("science") || r.includes("biology") || r.includes("physical science"))) return "Science";
  if (requirements.some((r) => r.includes("social studies") || r.includes("history") || r.includes("government"))) return "Social Studies";
  if (requirements.some((r) => r.includes("health") || r.includes("physical education") || r.includes("driver education"))) return "Physical Welfare";

  const title = course.title.toLowerCase();
  if (title.includes("algebra") || title.includes("geometry") || title.includes("precalculus") || title.includes("calculus")) return "Mathematics";
  if (title.includes("biology") || title.includes("chemistry") || title.includes("physics") || title.includes("science")) return "Science";
  if (title.includes("english") || title.includes("reading") || title.includes("writing") || title.includes("speech")) return "Communication Arts";
  if (title.includes("history") || title.includes("government") || title.includes("economics")) return "Social Studies";
  if (title.includes("health") || title.includes("fitness") || title.includes("physical education")) return "Physical Welfare";
  return "Summer School";
}

function extractSummerDivisions(courses: SummerCourse[]): string[] {
  return Array.from(new Set(courses.map(deriveSummerDivision))).sort();
}

function extractSummerGrades(courses: SummerCourse[]): number[] {
  const grades = new Set<number>();
  for (const course of courses) {
    for (const grade of course.gradeLevels ?? []) grades.add(grade);
  }
  return Array.from(grades).sort((a, b) => a - b);
}

function extractSummerCreditStatuses(courses: SummerCourse[]): string[] {
  return Array.from(new Set(courses.map((c) => c.creditStatus).filter(Boolean))).sort();
}

function extractSummerSessions(courses: SummerCourse[]): string[] {
  const sessions = new Set<string>();
  for (const course of courses) {
    for (const session of course.sessions ?? []) sessions.add(session);
  }
  return Array.from(sessions).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function extractSummerRequirements(courses: SummerCourse[]): string[] {
  const requirements = new Set<string>();
  for (const course of courses) {
    for (const requirement of course.fulfillsRequirements ?? []) requirements.add(requirement);
  }
  return Array.from(requirements).sort();
}

function summerCourseMatchesQuery(course: SummerCourse, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    course.title,
    course.courseCode,
    course.creditStatus,
    ...course.fulfillsRequirements,
    ...course.prerequisites,
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(normalized));
}

function summerCourseMatchesFilters(course: SummerCourse, filters: ActiveFilters): boolean {
  if (filters.division.length > 0 && !filters.division.includes(deriveSummerDivision(course))) return false;
  if (filters.creditType.length > 0 && !filters.creditType.includes(course.creditStatus)) return false;
  if (filters.gradeLevel.length > 0) {
    const selectedGrades = filters.gradeLevel.map((grade) => parseInt(grade, 10));
    if (!selectedGrades.some((grade) => (course.gradeLevels ?? []).includes(grade))) return false;
  }
  if (filters.semester.length > 0) {
    if (!filters.semester.some((session) => (course.sessions ?? []).includes(session))) return false;
  }
  if (filters.requirement.length > 0) {
    if (!filters.requirement.some((requirement) => course.fulfillsRequirements.includes(requirement))) return false;
  }
  return true;
}

function summerCourseToCatalogCourse(course: SummerCourse): Course {
  const division = deriveSummerDivision(course);
  const sessionText = (course.sessions ?? []).join(", ");
  const gradeText = (course.gradeLevels ?? []).map((grade) => `Grade ${grade}`).join(", ");
  const details = [sessionText, gradeText, formatSummerCreditStatus(course)]
    .filter(Boolean)
    .join(" | ");
  const descriptionParts = [
    details,
    course.fulfillsRequirements.length > 0
      ? `Requirements: ${course.fulfillsRequirements.join(", ")}`
      : null,
    course.prerequisites.length > 0
      ? `Prerequisites: ${course.prerequisites.join("; ")}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    id: -course.id,
    title: course.title,
    description: descriptionParts.join("\n"),
    fulfillsRequirements: course.fulfillsRequirements,
    department: {
      name: division,
      division: { name: division },
    },
    options: [
      {
        creditType: formatSummerCreditStatus(course),
        credits: course.credits,
        offerings: (course.sessions ?? []).map((session) => ({
          courseCode: course.courseCode ?? "",
          semesterLabel: session,
          duration: course.duration,
          gradeMin: course.gradeLevels && course.gradeLevels.length > 0 ? Math.min(...course.gradeLevels) : null,
          gradeMax: course.gradeLevels && course.gradeLevels.length > 0 ? Math.max(...course.gradeLevels) : null,
          credits: course.credits,
          prerequisites: course.prerequisites,
          corequisites: course.corequisites,
        })),
      },
    ],
  };
}

function formatSummerCreditStatus(course: SummerCourse): string {
  if (course.creditStatus === "credit") {
    return course.credits != null ? `Credit, ${formatCredits(course.credits)} credits` : "Credit";
  }
  if (course.creditStatus === "non-credit") return "Non-credit";
  return course.creditStatus || "Credit status unknown";
}

function CatalogSourceToggle({
  value,
  onChange,
}: {
  value: CatalogSource;
  onChange: (value: CatalogSource) => void;
}): React.ReactElement {
  const options: Array<{ value: CatalogSource; label: string }> = [
    { value: "regular", label: "Regular Coursebook" },
    { value: "summer", label: "Summer School Coursebook" },
  ];
  return (
    <div style={{ display: "inline-flex", padding: "4px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "10px", marginBottom: "20px" }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            style={{
              minHeight: "38px",
              padding: "0 16px",
              border: "none",
              borderRadius: "8px",
              backgroundColor: selected ? "var(--brand-accent)" : "transparent",
              color: selected ? "#ffffff" : "var(--text-secondary)",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
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

function parseSearchParams(sp: URLSearchParams): { query: string; filters: ActiveFilters; source: CatalogSource } {
  const source = sp.get("source") === "summer" ? "summer" : "regular";
  return {
    query: sp.get("q") || "",
    source,
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

function buildSearchParams(query: string, filters: ActiveFilters, source: CatalogSource): URLSearchParams {
  const params = new URLSearchParams();
  if (source === "summer") params.set("source", source);
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
  const [summerCourses, setSummerCourses] = useState<SummerCourse[]>([]);
  const [summerLoading, setSummerLoading] = useState(false);
  const [summerError, setSummerError] = useState<string | null>(null);

  const { query: initialQuery, filters, source } = useMemo(
    () => parseSearchParams(searchParams),
    [searchParams]
  );

  const { draft, setDraft, submitted, hasChanged, submit, handleKeyDown, clearAll } = useSearchSubmit(initialQuery);

  const syncUrl = useCallback(
    (q: string, f: ActiveFilters, catalogSource: CatalogSource = source) => {
      const params = buildSearchParams(q, f, catalogSource);
      const target = params.toString() ? `/catalog?${params.toString()}` : "/catalog";
      router.replace(target, { scroll: false });
    },
    [router, source]
  );

  const handleSearchSubmit = useCallback(() => {
    submit();
    syncUrl(draft, filters);
  }, [draft, filters, submit, syncUrl]);

  const setFilters = useCallback(
    (newFilters: ActiveFilters) => {
      syncUrl(submitted, newFilters);
    },
    [syncUrl, submitted]
  );

  // Sync back/forward navigation
  useEffect(() => {
    setDraft(initialQuery);
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (source !== "summer" || summerCourses.length > 0 || summerLoading) return;
    setSummerLoading(true);
    setSummerError(null);
    getSummerCourses()
      .then(setSummerCourses)
      .catch(() => setSummerError("Failed to load Summer School courses."))
      .finally(() => setSummerLoading(false));
  }, [source, summerCourses.length, summerLoading]);

  const sortData = useMemo(() => buildCourseSortData(courses), [courses]);
  const searchIndex = useMemo(() => buildCourseSearchIndex(courses), [courses]);

  const divisions = useMemo(
    () => extractDivisionsFromItems(courses, (course) => course.department?.division?.name),
    [courses]
  );
  const divisionDepartments = useMemo(() => extractDivisionDepartments(courses), [courses]);
  const departments = useMemo(() => extractDepartments(courses), [courses]);
  const creditTypes = useMemo(() => extractCreditTypes(courses), [courses]);
  const gradeLevels = useMemo(() => extractGradeLevels(courses), [courses]);
  const semesters = useMemo(() => extractSemesters(courses), [courses]);
  const summerDivisions = useMemo(() => extractSummerDivisions(summerCourses), [summerCourses]);
  const summerGrades = useMemo(() => extractSummerGrades(summerCourses), [summerCourses]);
  const summerCreditStatuses = useMemo(() => extractSummerCreditStatuses(summerCourses), [summerCourses]);
  const summerSessions = useMemo(() => extractSummerSessions(summerCourses), [summerCourses]);
  const summerRequirements = useMemo(() => extractSummerRequirements(summerCourses), [summerCourses]);

  const filteredCourses = useMemo(() => {
    return courses.filter(
      (course) =>
        courseMatchesQuery(course, submitted, searchIndex) && courseMatchesFilters(course, filters)
    );
  }, [courses, submitted, filters, searchIndex]);

  const sortedCourses = useMemo(() => {
    return sortCoursesByPrerequisites(filteredCourses, sortData);
  }, [filteredCourses, sortData]);

  const filteredSummerCourses = useMemo(() => {
    return summerCourses
      .filter((course) => summerCourseMatchesQuery(course, submitted) && summerCourseMatchesFilters(course, filters))
      .sort((a, b) => {
        const div = deriveSummerDivision(a).localeCompare(deriveSummerDivision(b));
        if (div !== 0) return div;
        return a.title.localeCompare(b.title);
      });
  }, [summerCourses, submitted, filters]);

  const handleSourceChange = useCallback(
    (nextSource: CatalogSource) => {
      if (nextSource === source) return;
      syncUrl(submitted, {
        division: [],
        department: [],
        creditType: [],
        gradeLevel: [],
        semester: [],
        requirement: [],
      }, nextSource);
    },
    [source, submitted, syncUrl]
  );

  const summerCatalogCourses = useMemo(
    () => filteredSummerCourses.map(summerCourseToCatalogCourse),
    [filteredSummerCourses]
  );

  return (
    <>
      <CatalogSourceToggle value={source} onChange={handleSourceChange} />
      <CourseSearch
        value={draft}
        onChange={setDraft}
        onSubmit={handleSearchSubmit}
        onKeyDown={handleKeyDown}
        disabled={!hasChanged}
        onClear={() => { clearAll(); syncUrl("", filters); }}
      />
      {source === "regular" ? (
        <>
          <CourseFilters
            divisions={divisions}
            divisionDepartments={divisionDepartments}
            departments={departments}
            creditTypes={creditTypes}
            gradeLevels={gradeLevels}
            semesters={semesters}
            filters={filters}
            onFilterChange={setFilters}
            showCourseFiltersWhenDivisionSelected
          />

          {sortedCourses.length === 0 ? (
            <EmptyState message={getEmptyStateMessage(submitted, filters)} />
          ) : (
            <CourseGrid courses={sortedCourses} />
          )}
        </>
      ) : (
        <>
          <CourseFilters
            divisions={summerDivisions}
            divisionDepartments={new Map()}
            departments={[]}
            creditTypes={summerCreditStatuses}
            gradeLevels={summerGrades}
            semesters={summerSessions}
            filters={filters}
            onFilterChange={setFilters}
            requirementValues={summerRequirements}
            showCourseFiltersImmediately
          />

          {summerLoading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading Summer School courses...</p>
          ) : summerError ? (
            <EmptyState message={summerError} />
          ) : filteredSummerCourses.length === 0 ? (
            <EmptyState message={getEmptyStateMessage(submitted, filters)} />
          ) : (
            <CourseGrid courses={summerCatalogCourses} getCourseHref={() => null} showSaveButtons={false} />
          )}
        </>
      )}
    </>
  );
}

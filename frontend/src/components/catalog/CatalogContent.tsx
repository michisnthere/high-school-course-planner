"use client";

import React, { useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Course } from "@/types/course";
import type { SummerCourse } from "@/lib/summerCourse";
import { useSummerCatalog } from "@/lib/summerCatalogLoader";
import {
  CATALOG_CREDIT_TYPES,
  CATALOG_GRADE_LEVELS,
  CATALOG_SEMESTERS,
  formatSummerCreditType,
  normalizeSummerCourseForCatalog,
  summerSessionToSemester,
  summerCourseSlug,
} from "@/lib/summerCatalog";
import {
  buildCourseSortData,
  buildCourseSearchIndex,
  sortCoursesByPrerequisites,
  courseMatchesQuery,
  effectiveCreditType,
  extractDivisionsFromItems,
} from "@/lib/catalog";
import { useSearchSubmit } from "@/hooks/useSearchSubmit";
import { CourseSearch } from "./CourseSearch";
import { CourseFilters, type ActiveFilters } from "./CourseFilters";
import { CourseGrid } from "./CourseGrid";
import { EmptyState } from "./EmptyState";

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
  const creditTypes = new Set<string>(CATALOG_CREDIT_TYPES);
  for (const course of courses) {
    for (const option of course.options ?? []) {
      const effective = effectiveCreditType(course.title, option.creditType);
      if (effective) {
        creditTypes.add(effective);
      }
    }
  }
  return Array.from(creditTypes).sort();
}

function extractGradeLevels(courses: Course[]): number[] {
  const grades = new Set<number>(CATALOG_GRADE_LEVELS);
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
  const semesters = new Set<string>(CATALOG_SEMESTERS);
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

function getSummerCourseHref(course: SummerCourse, currentSearch: string): string {
  const returnParam = currentSearch ? `?return=${encodeURIComponent("/catalog?" + currentSearch)}` : "";
  return `/summer-school/courses/${summerCourseSlug(course)}${returnParam}`;
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
      (option) => {
        const effective = effectiveCreditType(course.title, option.creditType);
        return effective && filters.creditType.includes(effective);
      }
    );
    if (!hasCreditType) return false;
  }

  if (filters.gradeLevel.length > 0) {
    const selectedGrades = filters.gradeLevel.map((grade) => parseInt(grade, 10));
    const hasGrade = course.options?.some((option) =>
      option.offerings?.some((offering) => {
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
  return course.division ?? "Summer School";
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
  const values = new Set<string>();
  for (const course of courses) {
    values.add(formatSummerCreditType(course));
  }
  return Array.from(values).sort();
}

function extractSummerSessions(courses: SummerCourse[]): string[] {
  const sessions = new Set<string>();
  for (const course of courses) {
    for (const session of course.sessions ?? []) {
      const semester = summerSessionToSemester(session);
      if (semester) sessions.add(semester);
    }
  }
  for (const semester of CATALOG_SEMESTERS) sessions.add(semester);
  return Array.from(sessions).sort();
}

function summerCourseMatchesQuery(course: SummerCourse, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    course.title,
    course.courseCode,
    course.description,
    course.creditStatus,
    course.division,
    course.instructionalCreditType,
    ...course.fulfillsRequirements,
    ...course.prerequisites,
    ...course.attributes,
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(normalized));
}

function summerCourseMatchesFilters(course: SummerCourse, filters: ActiveFilters): boolean {
  if (filters.division.length > 0 && !filters.division.includes(deriveSummerDivision(course))) return false;
  if (filters.creditType.length > 0) {
    if (!filters.creditType.includes(formatSummerCreditType(course))) return false;
  }
  if (filters.gradeLevel.length > 0) {
    const selectedGrades = filters.gradeLevel.map((grade) => parseInt(grade, 10));
    if (!selectedGrades.some((grade) => (course.gradeLevels ?? []).includes(grade))) return false;
  }
  if (filters.semester.length > 0) {
    const semesters = new Set(
      (course.sessions ?? [])
      .map(summerSessionToSemester)
      .filter((value): value is "1" | "2" => value != null)
    );
    if (course.duration === "full_summer") {
      semesters.add("1");
      semesters.add("2");
    }
    if (!filters.semester.some((semester) => semesters.has(semester as "1" | "2"))) return false;
  }
  if (filters.requirement.length > 0) {
    if (!filters.requirement.some((requirement) => course.fulfillsRequirements.includes(requirement))) return false;
  }
  return true;
}

function sanitizeFilters(
  filters: ActiveFilters,
  available: {
    divisions: string[];
    departments: string[];
    creditTypes: string[];
    gradeLevels: number[];
    semesters: string[];
  },
  options: { keepDepartments: boolean }
): ActiveFilters {
  const divisionSet = new Set(available.divisions);
  const departmentSet = new Set(available.departments);
  const creditTypeSet = new Set(available.creditTypes);
  const gradeLevelSet = new Set(available.gradeLevels.map(String));
  const semesterSet = new Set(available.semesters);

  return {
    division: filters.division.filter((value) => divisionSet.has(value)),
    department: options.keepDepartments
      ? filters.department.filter((value) => departmentSet.has(value))
      : [],
    creditType: filters.creditType.filter((value) => creditTypeSet.has(value)),
    gradeLevel: filters.gradeLevel.filter((value) => gradeLevelSet.has(value)),
    semester: filters.semester.filter((value) => semesterSet.has(value)),
    requirement: filters.requirement,
  };
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

  const { query: initialQuery, filters, source } = useMemo(
    () => parseSearchParams(searchParams),
    [searchParams]
  );

  // Summer catalog load lifecycle (idle -> loading -> success | error). The
  // fetch fires only when the Summer source becomes active, and a failure
  // settles into `error` instead of looping back to `loading` (see
  // summerCatalogLoader.ts). Retry is an explicit, single request.
  const { state: summer, load: retrySummerLoad } = useSummerCatalog({
    enabled: source === "summer",
  });

  const summerCourses = useMemo(
    () => (summer.status === "success" ? summer.courses : []),
    [summer]
  );
  const summerLoading = summer.status === "loading";
  const summerError = summer.status === "error" ? summer.message : null;

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

  const activeFilters = useMemo(() => {
    if (source === "summer") {
      return sanitizeFilters(
        filters,
        {
          divisions: summerDivisions,
          departments: [],
          creditTypes: summerCreditStatuses,
          gradeLevels: summerGrades,
          semesters: summerSessions,
        },
        { keepDepartments: false }
      );
    }

    return sanitizeFilters(
      filters,
      {
        divisions,
        departments,
        creditTypes,
        gradeLevels,
        semesters,
      },
      { keepDepartments: true }
    );
  }, [
    source,
    filters,
    summerDivisions,
    summerCreditStatuses,
    summerGrades,
    summerSessions,
    divisions,
    departments,
    creditTypes,
    gradeLevels,
    semesters,
  ]);

  const filteredCourses = useMemo(() => {
    return courses.filter(
      (course) =>
        courseMatchesQuery(course, submitted, searchIndex) && courseMatchesFilters(course, activeFilters)
    );
  }, [courses, submitted, activeFilters, searchIndex]);

  const sortedCourses = useMemo(() => {
    return sortCoursesByPrerequisites(filteredCourses, sortData);
  }, [filteredCourses, sortData]);

  const filteredSummerCourses = useMemo(() => {
    return summerCourses
      .filter((course) => summerCourseMatchesQuery(course, submitted) && summerCourseMatchesFilters(course, activeFilters))
      .sort((a, b) => {
        const div = deriveSummerDivision(a).localeCompare(deriveSummerDivision(b));
        if (div !== 0) return div;
        return a.title.localeCompare(b.title);
      });
  }, [summerCourses, submitted, activeFilters]);

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
    () => filteredSummerCourses.map(normalizeSummerCourseForCatalog),
    [filteredSummerCourses]
  );

  const summerCourseHrefMap = useMemo(() => {
    const currentSearch = searchParams.toString();
    const map = new Map<number, string>();
    for (const course of filteredSummerCourses) {
      const catalogCourse = normalizeSummerCourseForCatalog(course);
      map.set(catalogCourse.id, getSummerCourseHref(course, currentSearch));
    }
    return map;
  }, [filteredSummerCourses, searchParams]);

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
            filters={activeFilters}
            onFilterChange={setFilters}
            showCourseFiltersWhenDivisionSelected
            showCourseFiltersImmediately
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
            filters={activeFilters}
            onFilterChange={setFilters}
            showCourseFiltersImmediately
            creditTypeFormatter={(value) => value}
          />

{summerLoading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading Summer School courses...</p>
          ) : summerError ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <EmptyState message={summerError} />
              <button
                type="button"
                onClick={retrySummerLoad}
                disabled={summerLoading}
                style={{
                  minHeight: "44px",
                  padding: "10px 20px",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#ffffff",
                  backgroundColor: "var(--brand-accent)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: summerLoading ? "not-allowed" : "pointer",
                  opacity: summerLoading ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                Retry
              </button>
            </div>
          ) : filteredSummerCourses.length === 0 ? (
            <EmptyState message={getEmptyStateMessage(submitted, filters)} />
          ) : (
            <CourseGrid
              courses={summerCatalogCourses}
              getCourseHref={(course) => summerCourseHrefMap.get(course.id) ?? null}
              showSaveButtons={false}
            />
          )}
        </>
      )}
    </>
  );
}

import type { Course, Department, Division } from "@/types/course";

export type DepartmentGroup = {
  department: Department;
  courses: Course[];
};

export type DivisionGroup = {
  division: Division;
  departments: DepartmentGroup[];
};

function escapeRegExp(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&");
}

function getCourseCode(course: Course): string | null {
  const codes = course.options?.flatMap(
    (option) => option.offerings?.map((offering) => offering.courseCode) ?? []
  ) ?? [];
  const validCodes = codes.filter((c): c is string => typeof c === "string" && c.length > 0);
  return validCodes.length > 0 ? validCodes.sort()[0] : null;
}

function getCourseSortKey(course: Course): string {
  return getCourseCode(course) ?? course.title;
}

function buildPrerequisiteMap(courses: Course[]): Map<Course, Course[]> {
  const courseByCode = new Map<string, Course>();
  for (const course of courses) {
    for (const option of course.options ?? []) {
      for (const offering of option.offerings ?? []) {
        if (offering.courseCode) {
          courseByCode.set(offering.courseCode.toLowerCase(), course);
        }
      }
    }
  }

  const titleMatchers = [...courses].sort((a, b) => b.title.length - a.title.length);
  const prereqMap = new Map<Course, Course[]>();

  for (const course of courses) {
    const matches = new Set<Course>();

    for (const option of course.options ?? []) {
      for (const offering of option.offerings ?? []) {
        for (const prereqText of offering.prerequisites ?? []) {
          if (typeof prereqText !== "string") continue;
          const normalized = prereqText.toLowerCase();
          if (normalized === "none" || normalized === "n/a") continue;

          for (const candidate of titleMatchers) {
            if (candidate === course) continue;
            if (candidate.title.length === 0) continue;
            const pattern = new RegExp(`\\b${escapeRegExp(candidate.title)}\\b`, "i");
            if (pattern.test(normalized)) {
              matches.add(candidate);
            }
          }

          const codeMatches = normalized.match(/\b[a-z]{3}\d{3}\b/gi);
          for (const code of codeMatches ?? []) {
            const matched = courseByCode.get(code.toLowerCase());
            if (matched && matched !== course) {
              matches.add(matched);
            }
          }
        }
      }
    }

    prereqMap.set(course, Array.from(matches));
  }

  return prereqMap;
}

/**
 * Return every catalog course that lists `course` as a prerequisite.
 *
 * Reuses `buildPrerequisiteMap` so the reverse lookup uses the exact same
 * title + course-code matching logic as the forward prerequisite relationship
 * (and the catalog prerequisite sorting). The result is computed from the
 * already-fetched catalog, so it requires no extra database queries, returns
 * only real catalog courses, contains no duplicates (Set-based), and returns
 * an empty array when no course depends on `course`.
 */
export function getCoursesRequiringPrerequisite(
  course: Course,
  allCourses: Course[]
): Course[] {
  if (!course || allCourses.length === 0) return [];
  const prereqMap = buildPrerequisiteMap(allCourses);
  const dependents: Course[] = [];
  for (const [candidate, prereqs] of prereqMap) {
    if (candidate.id === course.id) continue;
    if (prereqs.some((p) => p.id === course.id)) {
      dependents.push(candidate);
    }
  }
  return dependents.sort((a, b) => a.title.localeCompare(b.title));
}

function computePrerequisiteDepth(
  course: Course,
  prereqMap: Map<Course, Course[]>,
  memo: Map<Course, number>,
  visiting: Set<Course>
): number {
  if (memo.has(course)) return memo.get(course)!;
  if (visiting.has(course)) return 0;

  visiting.add(course);
  const prereqs = prereqMap.get(course) ?? [];
  let maxDepth = 0;
  for (const prereq of prereqs) {
    const depth = computePrerequisiteDepth(prereq, prereqMap, memo, visiting);
    maxDepth = Math.max(maxDepth, depth + 1);
  }
  visiting.delete(course);
  memo.set(course, maxDepth);
  return maxDepth;
}

function getCourseMinGradeLevel(course: Course): number {
  let minGrade = Infinity;
  for (const option of course.options ?? []) {
    for (const offering of option.offerings ?? []) {
      if (offering.gradeMin != null || offering.gradeMax != null) {
        const grade = offering.gradeMin ?? 9;
        if (grade < minGrade) {
          minGrade = grade;
        }
      }
    }
  }
  return Number.isFinite(minGrade) ? minGrade : 9;
}

export type CourseSortData = {
  depth: number;
  minGrade: number;
};

export function buildCourseSortData(courses: Course[]): Map<number, CourseSortData> {
  const prereqMap = buildPrerequisiteMap(courses);
  const depthMemo = new Map<Course, number>();
  const result = new Map<number, CourseSortData>();

  for (const course of courses) {
    const depth = computePrerequisiteDepth(course, prereqMap, depthMemo, new Set());
    const minGrade = getCourseMinGradeLevel(course);
    result.set(course.id, { depth, minGrade });
  }

  return result;
}

function compareBySortData(sortData: Map<number, CourseSortData>): (a: Course, b: Course) => number {
  return (a, b) => {
    const da = sortData.get(a.id) ?? { minGrade: 9, depth: 0 };
    const db = sortData.get(b.id) ?? { minGrade: 9, depth: 0 };
    if (da.minGrade !== db.minGrade) return da.minGrade - db.minGrade;
    if (da.depth !== db.depth) return da.depth - db.depth;
    return a.title.localeCompare(b.title);
  };
}

export function sortCoursesByPrerequisites(
  courses: Course[],
  sortData?: Map<number, CourseSortData>
): Course[] {
  if (courses.length <= 1) return [...courses];
  const data = sortData ?? buildCourseSortData(courses);
  return [...courses].sort(compareBySortData(data));
}

export function groupCoursesByDivision(courses: Course[]): DivisionGroup[] {
  const map = new Map<string, DivisionGroup>();

  for (const course of courses) {
    const division = course.department?.division;
    const divisionName = division?.name ?? "Uncategorized";
    const department = course.department;
    const departmentName = department?.name ?? "Uncategorized";

    let group = map.get(divisionName);
    if (!group) {
      group = {
        division: division ?? { name: "Uncategorized" },
        departments: [],
      };
      map.set(divisionName, group);
    }

    let deptGroup = group.departments.find(
      (d) => d.department.name === departmentName
    );
    if (!deptGroup) {
      deptGroup = {
        department: department ?? { name: "Uncategorized" },
        courses: [],
      };
      group.departments.push(deptGroup);
    }

    deptGroup.courses.push(course);
  }

  for (const group of map.values()) {
    group.departments.sort((a, b) => a.department.name.localeCompare(b.department.name));
  }

  return Array.from(map.values()).sort((a, b) =>
    a.division.name.localeCompare(b.division.name)
  );
}

export function sortAndGroupCourses(
  courses: Course[],
  sortData?: Map<number, CourseSortData>
): DivisionGroup[] {
  const sorted = sortCoursesByPrerequisites(courses, sortData);
  return groupCoursesByDivision(sorted);
}

export function buildCourseSearchIndex(courses: { id: number; title: string }[]): Map<number, string> {
  const index = new Map<number, string>();
  for (const course of courses) {
    index.set(course.id, course.title.toLowerCase());
  }
  return index;
}

export function courseMatchesQuery(
  course: { id: number; title: string },
  query: string,
  searchIndex?: Map<number, string>
): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return true;
  if (searchIndex) {
    const searchable = searchIndex.get(course.id);
    if (searchable) return searchable.includes(normalizedQuery);
  }
  return course.title.toLowerCase().includes(normalizedQuery);
}

export function courseMatchesDivisionFilter(
  courseDivision: string | null | undefined,
  selectedDivision: string | null
): boolean {
  if (!selectedDivision) return true;
  return courseDivision === selectedDivision;
}

export function extractDivisionsFromItems<T>(
  items: T[],
  getDivision: (item: T) => string | null | undefined
): string[] {
  const divisions = new Set<string>();
  for (const item of items) {
    const division = getDivision(item);
    if (division) divisions.add(division);
  }
  return Array.from(divisions).sort();
}

/**
 * Effective credit type for a course.
 *
 * The catalog stores all rigorous course loads under `creditType: "Honors"`,
 * and the AP designation only exists in the course title prefix (e.g.
 * "AP Biology"). Rather than collapsing AP and Honors into one label, we
 * derive the displayed/filtered credit type here so an "AP" course reads as
 * "AP" while a true honors course reads as "Honors". This is purely a
 * frontend representation decision; the underlying extraction data is
 * untouched.
 */
export function effectiveCreditType(
  title: string | null | undefined,
  creditType: string | null | undefined
): string | null {
  if (!creditType) return null;
  if (creditType === "AP") return "AP";
  if (creditType === "Honors" && /^AP\s/i.test(title?.trim() ?? "")) return "AP";
  return creditType;
}

export function formatCreditType(
  creditType: string | null | undefined,
  courseTitle?: string | null
): string | null {
  return effectiveCreditType(courseTitle, creditType);
}

export function formatSemesterLabel(semester: string): string {
  if (semester === "1") return "Semester 1";
  if (semester === "2") return "Semester 2";
  return semester;
}

export function formatPrerequisiteForDisplay(prereq: string): string {
  const lower = prereq.trim().toLowerCase();
  if (lower === "any precalculus course") return "Precalculus";
  if (lower === "any ap precalculus course") return "AP Precalculus";
  if (lower === "a foundational fitness class") return "Freshman Foundational Fitness";
  if (lower === "a foundational fitness course") return "Freshman Foundational Fitness";
  if (lower.includes("foundational fitness") && lower.includes("any previous")) {
    return "Freshman Foundational Fitness, any previous Physical Education course";
  }
  return prereq.trim();
}

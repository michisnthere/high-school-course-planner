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

export function sortCoursesByPrerequisites(courses: Course[]): Course[] {
  if (courses.length <= 1) return [...courses];

  const courseList = [...courses];
  const prereqMap = buildPrerequisiteMap(courseList);
  const memo = new Map<Course, number>();

  const depths = new Map<Course, number>();
  const minGrades = new Map<Course, number>();
  for (const course of courseList) {
    depths.set(course, computePrerequisiteDepth(course, prereqMap, memo, new Set()));
    minGrades.set(course, getCourseMinGradeLevel(course));
  }

  return courseList.sort((a, b) => {
    const gradeA = minGrades.get(a) ?? 9;
    const gradeB = minGrades.get(b) ?? 9;
    if (gradeA !== gradeB) return gradeA - gradeB;

    const depthA = depths.get(a) ?? 0;
    const depthB = depths.get(b) ?? 0;
    if (depthA !== depthB) return depthA - depthB;

    return a.title.localeCompare(b.title);
  });
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

export function sortAndGroupCourses(courses: Course[]): DivisionGroup[] {
  const sorted = sortCoursesByPrerequisites(courses);
  return groupCoursesByDivision(sorted);
}

export function courseMatchesQuery(course: { title: string }, query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return true;
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

import type { Course } from "@/types/course";
import type { SummerCourse } from "@/lib/summerCourse";
import { normalizeTitle } from "@/lib/normalize";
import { formatCredits } from "@/lib/courseCredits";

export const CATALOG_CREDIT_TYPES = ["Accelerated", "College Prep", "AP", "Honors"] as const;
export const CATALOG_GRADE_LEVELS = [9, 10, 11, 12] as const;
export const CATALOG_SEMESTERS = ["1", "2"] as const;

export type CatalogCreditType = (typeof CATALOG_CREDIT_TYPES)[number];

export function summerCourseSlug(course: SummerCourse): string {
  return course.key || normalizeTitle(course.title);
}

export function summerSessionToSemester(session: string): "1" | "2" | null {
  // Summer School keeps "Session 1" / "Session 2" in the database. The shared
  // catalog UI labels those filter buckets as Semester 1 / Semester 2.
  if (session === "Session 1") return "1";
  if (session === "Session 2") return "2";
  return null;
}

export function formatSummerCredits(course: SummerCourse): string {
  if (course.creditStatus === "non-credit") return "Non-credit";
  if (course.credits != null) return `${formatCredits(course.credits)} credits`;
  if (course.creditStatus === "unknown") return "Credit unknown";
  return "Credit";
}

export function formatSummerCreditType(course: SummerCourse): string {
  if (course.creditStatus === "non-credit") return "Non-credit";
  if (course.creditStatus === "unknown") return "Credit unknown";
  return "Credit";
}

export function formatSummerGrades(course: SummerCourse): string | null {
  const grades = [...(course.gradeLevels ?? [])].sort((a, b) => a - b);
  if (grades.length === 0) return null;
  if (grades.length === 1) return `Grade ${grades[0]}`;
  return `Grades ${grades.join(", ")}`;
}

export function formatSummerSessions(course: SummerCourse): string | null {
  const semesters = (course.sessions ?? [])
    .map(summerSessionToSemester)
    .filter((value): value is "1" | "2" => value != null);
  if (semesters.length === 0) return null;
  return `Semester ${[...new Set(semesters)].join("/")}`;
}

export function normalizeSummerCourseForCatalog(course: SummerCourse): Course {
  const division = course.division ?? "Summer School";
  const creditType = formatSummerCreditType(course);
  const gradeLevels = course.gradeLevels ?? [];
  const grades = formatSummerGrades(course);
  const sessions = formatSummerSessions(course);
  const credits = formatSummerCredits(course);
  const meta = [
    course.courseCode ?? null,
    credits,
    grades,
    sessions,
  ].filter((value): value is string => Boolean(value));

  return {
    id: -course.id,
    title: course.title,
    courseCode: course.courseCode,
    normalizedTitle: summerCourseSlug(course),
    description: course.description,
    notes: course.notes,
    attributes: course.attributes,
    fulfillsRequirements: course.fulfillsRequirements,
    catalogMeta: meta,
    department: {
      name: division,
      division: { name: division },
    },
    options: [
      {
        creditType,
        credits: course.credits,
        offerings: (course.sessions ?? []).map((session) => ({
          courseCode: course.courseCode ?? "",
          semesterLabel: summerSessionToSemester(session) ?? session,
          duration: course.duration === "full_summer" ? "2" : "1",
          gradeMin: gradeLevels.length > 0 ? Math.min(...gradeLevels) : null,
          gradeMax: gradeLevels.length > 0 ? Math.max(...gradeLevels) : null,
          credits: course.credits,
          prerequisites: course.prerequisites,
          corequisites: course.corequisites,
        })),
      },
    ],
  };
}

export function findSummerCourseBySlug(courses: SummerCourse[], slug: string): SummerCourse | undefined {
  return courses.find((course) => summerCourseSlug(course) === slug || normalizeTitle(course.title) === slug);
}

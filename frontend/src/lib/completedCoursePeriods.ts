import type { CompletedCourse, GradeCompleted } from "@/lib/completedCourses";

// Defines the grade-level options shown when recording a completed course.
// The per-year summer values are kept here (data entry) so a student can
// record which year a summer course was taken; they are only collapsed for
// *display/filtering* on the Completed Courses page.
export const ACADEMIC_PERIODS = [
  { label: "Middle School", values: ["Middle School"] },
  { label: "Freshman", values: ["Freshman (9)"] },
  { label: "Freshman Summer", values: ["Freshman Summer"] },
  { label: "Sophomore", values: ["Sophomore (10)"] },
  { label: "Sophomore Summer", values: ["Sophomore Summer"] },
  { label: "Junior", values: ["Junior (11)"] },
  { label: "Junior Summer", values: ["Junior Summer"] },
  { label: "Senior", values: ["Senior (12)"] },
  { label: "Senior Summer", values: ["Senior Summer"] },
  { label: "Summer School", values: ["Summer School"] },
] as const;

// Filter buttons shown on the Completed Courses page. The per-year summer
// filters are intentionally omitted; all summer courses surface under a
// single "Summer School" filter, which is subdivided by year when displayed.
export const FILTER_ORDER = [
  "All",
  "Middle School",
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Summer School",
] as const;
export type CompletedCourseFilter = (typeof FILTER_ORDER)[number];

export type AcademicPeriodLabel = (typeof ACADEMIC_PERIODS)[number]["label"];

const PERIOD_BY_GRADE = new Map<GradeCompleted, AcademicPeriodLabel>(
  ACADEMIC_PERIODS.flatMap((period) =>
    period.values.map((value) => [value as GradeCompleted, period.label])
  )
);

/** Regular (non-summer) period groups, in display order. */
const NON_SUMMER_DISPLAY_ORDER: AcademicPeriodLabel[] = [
  "Middle School",
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
];

/** gradeCompleted values that represent summer work. */
const SUMMER_GRADES: ReadonlySet<GradeCompleted> = new Set<GradeCompleted>([
  "Freshman Summer",
  "Sophomore Summer",
  "Junior Summer",
  "Senior Summer",
  "Summer School",
]);

/** Order of the year-based subsections shown inside the Summer School group. */
const SUMMER_SUBSECTION_ORDER: GradeCompleted[] = [
  "Freshman Summer",
  "Sophomore Summer",
  "Junior Summer",
  "Senior Summer",
  "Summer School",
];

export type SummerSubSection = { yearLabel: string; courses: CompletedCourse[] };

export type CompletedCourseGroup = {
  label: string;
  courses: CompletedCourse[];
  /** True for the consolidated Summer School group (has nested subsections). */
  isSummer?: boolean;
  /** Year-based subsections, only populated for the Summer School group. */
  summerSubSections?: SummerSubSection[];
};

export function getAcademicPeriodLabel(gradeCompleted: GradeCompleted): AcademicPeriodLabel {
  return PERIOD_BY_GRADE.get(gradeCompleted) ?? "Summer School";
}

/**
 * A course completed during summer work is any gradeCompleted value that is
 * one of the per-year summer grades (Freshman Summer …) or the generic
 * "Summer School" grade.
 */
export function isSummerGrade(gradeCompleted: GradeCompleted): boolean {
  return SUMMER_GRADES.has(gradeCompleted);
}

export function isSummerCompletedCourse(course: CompletedCourse): boolean {
  return isSummerGrade(course.gradeCompleted);
}

/**
 * Year-based subsection label for a summer course. Falls back to the
 * gradeCompleted value itself (e.g. "Freshman Summer" -> "Freshman Summer").
 */
export function summerYearLabel(gradeCompleted: GradeCompleted): string {
  return gradeCompleted;
}

export function groupCompletedCoursesByPeriod(courses: CompletedCourse[]): CompletedCourseGroup[] {
  // Initialize non-summer buckets preserving display order.
  const nonSummerBuckets = new Map<AcademicPeriodLabel, CompletedCourse[]>();
  for (const label of NON_SUMMER_DISPLAY_ORDER) {
    nonSummerBuckets.set(label, []);
  }

  // Initialize summer subsections.
  const summerBuckets = new Map<GradeCompleted, CompletedCourse[]>();
  for (const grade of SUMMER_SUBSECTION_ORDER) {
    summerBuckets.set(grade, []);
  }

  for (const course of courses) {
    if (isSummerCompletedCourse(course)) {
      const bucket = summerBuckets.get(course.gradeCompleted) ?? [];
      summerBuckets.set(course.gradeCompleted, [...bucket, course]);
    } else {
      const label = getAcademicPeriodLabel(course.gradeCompleted);
      const existing = nonSummerBuckets.get(label) ?? [];
      nonSummerBuckets.set(label, [...existing, course]);
    }
  }

  const result: CompletedCourseGroup[] = [];

  for (const label of NON_SUMMER_DISPLAY_ORDER) {
    result.push({ label, courses: nonSummerBuckets.get(label) ?? [], isSummer: false });
  }

  // Assemble the consolidated Summer School group (only if it has courses).
  const summerCourses: CompletedCourse[] = [];
  const summerSubSections: SummerSubSection[] = [];
  for (const grade of SUMMER_SUBSECTION_ORDER) {
    const items = summerBuckets.get(grade) ?? [];
    if (items.length === 0) continue;
    summerCourses.push(...items);
    summerSubSections.push({ yearLabel: summerYearLabel(grade), courses: items });
  }

  result.push({
    label: "Summer School",
    courses: summerCourses,
    isSummer: true,
    summerSubSections: summerSubSections.length > 0 ? summerSubSections : undefined,
  });

  return result;
}

export function filterCompletedCoursesByPeriod(
  courses: CompletedCourse[],
  filter: CompletedCourseFilter
): CompletedCourse[] {
  if (filter === "All") return courses;
  if (filter === "Summer School") return courses.filter(isSummerCompletedCourse);
  return courses.filter((course) => getAcademicPeriodLabel(course.gradeCompleted) === filter);
}

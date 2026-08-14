import {
  GRADE_COMPLETED_OPTIONS,
  type CompletedCourse,
  type GradeCompleted,
} from "@/lib/completedCourses";
import { normalizeTitle } from "@/lib/normalize";

// Defines the grade-level options shown when recording a completed course.
// The per-year summer values are kept here (data entry) so a student can
// record which year a summer course was taken; they are only collapsed for
// *display/filtering* on the Completed Courses page. "Middle School Summer" is
// the summer-before-middle-school period; the other per-year values are the
// summer between each grade (e.g. "Freshman Summer" = the summer between
// middle school and 9th grade).
export const ACADEMIC_PERIODS = [
  { label: "Middle School", values: ["Middle School"] },
  { label: "Middle School Summer", values: ["Middle School Summer"] },
  { label: "Freshman", values: ["Freshman (9)"] },
  { label: "Freshman Summer", values: ["Freshman Summer"] },
  { label: "Sophomore", values: ["Sophomore (10)"] },
  { label: "Sophomore Summer", values: ["Sophomore Summer"] },
  { label: "Junior", values: ["Junior (11)"] },
  { label: "Junior Summer", values: ["Junior Summer"] },
  { label: "Senior", values: ["Senior (12)"] },
  { label: "Senior Summer", values: ["Senior Summer"] },
  // Legacy stored value for summer work. It is retained so existing records
  // keep loading, but it is NOT offered as a grade level anywhere: Summer
  // School is a course/program context, not a grade level.
  { label: "Summer School", values: ["Summer School"] },
] as const;

// Filter buttons shown on the Completed Courses page. "Summer School" is a
// program context, not a grade level, so it is NOT a filter option. Per-year
// summer values are intentionally omitted as filters too; all summer courses
// surface under "All", consolidated into a single Summer School section that is
// subdivided by year when displayed.
export const FILTER_ORDER = [
  "All",
  "Middle School",
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
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

/** gradeCompleted values that represent summer work. Includes the legacy
 * generic "Summer School" value so existing records stay valid. */
const SUMMER_GRADES: ReadonlySet<GradeCompleted> = new Set<GradeCompleted>([
  "Middle School Summer",
  "Freshman Summer",
  "Sophomore Summer",
  "Junior Summer",
  "Senior Summer",
  "Summer School",
]);

/** The Summer-specific grade periods a selector should offer, in progression
 * order (summer before middle school, then between each grade). The generic
 * "Summer School" value is a program context and is intentionally excluded. */
const SUMMER_PERIOD_OPTIONS = [
  "Middle School Summer",
  "Freshman Summer",
  "Sophomore Summer",
  "Junior Summer",
  "Senior Summer",
] as const;

/** Order of the year-based subsections shown inside the Summer School group. */
const SUMMER_SUBSECTION_ORDER: GradeCompleted[] = [
  ...SUMMER_PERIOD_OPTIONS,
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
  return courses.filter((course) => getAcademicPeriodLabel(course.gradeCompleted) === filter);
}

/**
 * Live, case-insensitive search over Summer School courses by title. Matches
 * against normalized titles so punctuation and casing never block a result
 * (e.g. "careers" or "careers in" both find "Careers in Business"). An empty
 * query returns every course unchanged.
 */
export function filterSummerCoursesByQuery<T extends { title: string }>(
  courses: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return courses;
  const qNorm = normalizeTitle(q);
  return courses.filter((course) => {
    const title = course.title.toLowerCase();
    const titleNorm = normalizeTitle(course.title);
    return title.includes(q) || (titleNorm.length > 0 && titleNorm.includes(qNorm));
  });
}

// ---------------------------------------------------------------------------
// Context-aware grade option subsets. These are the canonical lists a
// completed-course grade selector should offer, and they are mutually
// exclusive: a regular course selector NEVER shows summer periods and a Summer
// School selector NEVER shows regular periods.
// ---------------------------------------------------------------------------

export const REGULAR_GRADE_COMPLETED_OPTIONS: GradeCompleted[] = GRADE_COMPLETED_OPTIONS.filter(
  (g) => !SUMMER_GRADES.has(g)
);

export const SUMMER_GRADE_COMPLETED_OPTIONS: GradeCompleted[] = [...SUMMER_PERIOD_OPTIONS];

/** The grade options a completed-course selector should offer for a course type. */
export function gradeOptionsForContext(isSummer: boolean): GradeCompleted[] {
  return isSummer ? SUMMER_GRADE_COMPLETED_OPTIONS : REGULAR_GRADE_COMPLETED_OPTIONS;
}

/** Whether a gradeCompleted value belongs to the given course context. */
export function isGradeValidForContext(grade: GradeCompleted, isSummer: boolean): boolean {
  return SUMMER_GRADES.has(grade) === isSummer;
}

/**
 * Context-appropriate default grade. Preserves `preferred` when it belongs to
 * the context; otherwise falls back to the first option for that context.
 * Used when opening a selector or when an existing record holds a grade that
 * does not match its course type (defensive recovery instead of a mixed state).
 */
export function defaultGradeForContext(isSummer: boolean, preferred?: GradeCompleted): GradeCompleted {
  if (preferred && isGradeValidForContext(preferred, isSummer)) return preferred;
  return isSummer ? "Middle School Summer" : "Middle School";
}

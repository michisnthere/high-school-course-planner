import type { CompletedCourse, GradeCompleted } from "@/lib/completedCourses";

export const ACADEMIC_PERIODS = [
  { label: "Middle School", values: ["Middle School"] },
  { label: "Freshman", values: ["Freshman (9)"] },
  { label: "Sophomore", values: ["Sophomore (10)"] },
  { label: "Junior", values: ["Junior (11)"] },
  { label: "Senior", values: ["Senior (12)"] },
  { label: "Summer School", values: ["Summer School"] },
] as const;

export const FILTER_ORDER = ["All", "Middle School", "Freshman", "Sophomore", "Junior", "Senior", "Summer School"] as const;
export type CompletedCourseFilter = (typeof FILTER_ORDER)[number];

export type AcademicPeriodLabel = (typeof ACADEMIC_PERIODS)[number]["label"];

const PERIOD_BY_GRADE = new Map<GradeCompleted, AcademicPeriodLabel>(
  ACADEMIC_PERIODS.flatMap((period) =>
    period.values.map((value) => [value as GradeCompleted, period.label])
  )
);

export function getAcademicPeriodLabel(gradeCompleted: GradeCompleted): AcademicPeriodLabel {
  return PERIOD_BY_GRADE.get(gradeCompleted) ?? "Summer School";
}

export function groupCompletedCoursesByPeriod(courses: CompletedCourse[]) {
  const grouped = new Map<string, CompletedCourse[]>();
  for (const period of ACADEMIC_PERIODS) {
    grouped.set(period.label, []);
  }

  for (const course of courses) {
    const label = getAcademicPeriodLabel(course.gradeCompleted);
    grouped.set(label, [...(grouped.get(label) ?? []), course]);
  }

  return Array.from(grouped.entries()).map(([label, items]) => ({
    label,
    courses: items,
  }));
}

export function filterCompletedCoursesByPeriod(
  courses: CompletedCourse[],
  filter: CompletedCourseFilter
): CompletedCourse[] {
  if (filter === "All") return courses;
  return courses.filter((course) => getAcademicPeriodLabel(course.gradeCompleted) === filter);
}

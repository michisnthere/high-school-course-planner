import type { PlannerCourseDetails } from "@/lib/planner";
import type { SummerCourse } from "@/lib/summerCourse";

export const GRADE_COMPLETED_OPTIONS = [
  "Middle School",
  "Summer School",
  "Freshman (9)",
  "Freshman Summer",
  "Sophomore (10)",
  "Sophomore Summer",
  "Junior (11)",
  "Junior Summer",
  "Senior (12)",
  "Senior Summer",
] as const;

export type GradeCompleted = (typeof GRADE_COMPLETED_OPTIONS)[number];

const ACADEMIC_GRADE_BY_YEAR: Record<number, GradeCompleted> = {
  9: "Freshman (9)",
  10: "Sophomore (10)",
  11: "Junior (11)",
  12: "Senior (12)",
};

const SUMMER_GRADE_BY_YEAR: Record<number, GradeCompleted> = {
  9: "Freshman Summer",
  10: "Sophomore Summer",
  11: "Junior Summer",
  12: "Senior Summer",
};

export function getEligibleCompletedGrades(currentYear: number): GradeCompleted[] {
  const eligible: GradeCompleted[] = ["Middle School"];
  for (const year of [9, 10, 11, 12]) {
    if (year >= currentYear) continue;
    eligible.push(ACADEMIC_GRADE_BY_YEAR[year]);
    eligible.push(SUMMER_GRADE_BY_YEAR[year]);
  }
  return eligible;
}

export function getDefaultCompletedGrade(currentYear: number): GradeCompleted {
  if (currentYear <= 9) return "Middle School";
  return ACADEMIC_GRADE_BY_YEAR[currentYear - 1];
}

export type CompletedCourse = {
  id: number;
  userId: number;
  courseId: number | null;
  summerCourseId: number | null;
  gradeCompleted: GradeCompleted;
  letterGrade?: string | null;
  credits: number | null;
  course: PlannerCourseDetails | null;
  summerCourse: SummerCourse | null;
};

export type CompletedCourseInput = {
  courseId?: number;
  summerCourseId?: number;
  gradeCompleted: GradeCompleted;
};

export async function getCompletedCourses(): Promise<CompletedCourse[]> {
  const response = await fetch(`/api/completed-courses`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch completed courses");
  }

  return response.json();
}

export async function addCompletedCourse(
  courseId: number | null,
  gradeCompleted: GradeCompleted,
  _courseDetails?: PlannerCourseDetails,
  summerCourseId?: number
): Promise<CompletedCourse> {
  const response = await fetch(`/api/completed-courses`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, summerCourseId, gradeCompleted }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Failed to add completed course" }));
    throw new Error(data.error || "Failed to add completed course");
  }

  const data = await response.json();
  window.dispatchEvent(new Event("completed-courses:changed"));
  return data;
}

export async function updateCompletedCourse(
  id: number,
  updates: { gradeCompleted?: GradeCompleted }
): Promise<CompletedCourse> {
  const response = await fetch(`/api/completed-courses/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Failed to update completed course" }));
    throw new Error(data.error || "Failed to update completed course");
  }

  const data = await response.json();
  window.dispatchEvent(new Event("completed-courses:changed"));
  return data;
}

export async function removeCompletedCourse(id: number): Promise<void> {
  const response = await fetch(`/api/completed-courses/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ error: "Failed to remove completed course" }));
    throw new Error(data.error || "Failed to remove completed course");
  }

  window.dispatchEvent(new Event("completed-courses:changed"));
}

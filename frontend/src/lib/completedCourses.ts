import type { PlannerCourseDetails } from "@/lib/planner";

export const GRADE_COMPLETED_OPTIONS = [
  "Middle School",
  "Summer School",
  "Freshman (9)",
  "Sophomore (10)",
  "Junior (11)",
  "Senior (12)",
] as const;

export const LETTER_GRADE_OPTIONS = ["A", "B", "C", "D", "F"] as const;

export type GradeCompleted = (typeof GRADE_COMPLETED_OPTIONS)[number];

export type LetterGrade = (typeof LETTER_GRADE_OPTIONS)[number];

export type CompletedCourse = {
  id: number;
  userId: number;
  courseId: number;
  gradeCompleted: GradeCompleted;
  letterGrade: string | null;
  credits: number | null;
  course: PlannerCourseDetails;
};

export type CompletedCourseInput = {
  courseId: number;
  gradeCompleted: GradeCompleted;
  letterGrade?: string | null;
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
  courseId: number,
  gradeCompleted: GradeCompleted,
  letterGrade?: string | null
): Promise<CompletedCourse> {
  const response = await fetch(`/api/completed-courses`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, gradeCompleted, letterGrade }),
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
  updates: { letterGrade?: string | null; gradeCompleted?: GradeCompleted }
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

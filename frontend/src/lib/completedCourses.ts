import type { PlannerCourseDetails } from "@/lib/planner";

// Server-side fetches need the backend directly; client-side fetches use relative URLs
// so they work through the Replit proxy and Next.js rewrites.
const API_URL =
  typeof window === "undefined" ? "http://localhost:4000" : process.env.NEXT_PUBLIC_API_URL || "";

export const GRADE_COMPLETED_OPTIONS = [
  "Middle School",
  "Freshman (9)",
  "Sophomore (10)",
  "Junior (11)",
  "Senior (12)",
] as const;

export type GradeCompleted = (typeof GRADE_COMPLETED_OPTIONS)[number];

export type CompletedCourse = {
  id: number;
  userId: number;
  courseId: number;
  gradeCompleted: GradeCompleted;
  credits: number | null;
  course: PlannerCourseDetails;
};

export type CompletedCourseInput = {
  courseId: number;
  gradeCompleted: GradeCompleted;
};

export async function getCompletedCourses(): Promise<CompletedCourse[]> {
  const response = await fetch(`${API_URL}/api/completed-courses`, {
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
  yearCompleted?: string
): Promise<CompletedCourse> {
  const response = await fetch(`${API_URL}/api/completed-courses`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, gradeCompleted, yearCompleted }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Failed to add completed course" }));
    throw new Error(data.error || "Failed to add completed course");
  }

  const data = await response.json();
  window.dispatchEvent(new Event("completed-courses:changed"));
  return data;
}

export async function removeCompletedCourse(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/completed-courses/${id}`, {
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

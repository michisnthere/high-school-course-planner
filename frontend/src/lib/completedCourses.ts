import type { Course } from "@/types/course";

// Server-side fetches need the backend directly; client-side fetches use relative URLs
// so they work through the Replit proxy and Next.js rewrites.
const API_URL =
  typeof window === "undefined" ? "http://localhost:4000" : process.env.NEXT_PUBLIC_API_URL || "";

export type CompletedCourse = {
  id: number;
  userId: number;
  courseId: number;
  gradeLevelTaken: number;
  yearTaken: number;
  credits: number | null;
  createdAt: string;
  course: Course;
};

export type CompletedCourseInput = {
  courseId: number;
  gradeLevelTaken: number;
  yearTaken: number;
  credits?: number | null;
};

export async function getCompletedCourses(): Promise<CompletedCourse[]> {
  const response = await fetch(`${API_URL}/completed-courses`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch completed courses");
  }

  return response.json();
}

export async function addCompletedCourse(input: CompletedCourseInput): Promise<CompletedCourse> {
  const response = await fetch(`${API_URL}/completed-courses`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Failed to add completed course" }));
    throw new Error(data.error || "Failed to add completed course");
  }

  return response.json();
}

export async function removeCompletedCourse(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/completed-courses/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ error: "Failed to remove completed course" }));
    throw new Error(data.error || "Failed to remove completed course");
  }
}

// Server-side fetches need the backend directly; client-side fetches use relative URLs
// so they work through the Replit proxy and Next.js rewrites.
const API_URL =
  typeof window === "undefined" ? "http://localhost:4000" : process.env.NEXT_PUBLIC_API_URL || "";

export type CourseDuration = number;

export type PlannerCourseDetails = {
  id: number;
  title: string;
  normalizedTitle: string | null;
  duration: CourseDuration;
  creditType: string | null;
  credits: number | null;
  division: string | null;
  department: string | null;
  description: string | null;
  fulfillsRequirements: string[];
  prerequisites: string[];
  courseCode: string | null;
};

export type PlannerOption = {
  id: number;
  name: string;
  duration: number;
  credits: number;
  availableGrades: number[];
  maxPerYear: number | null;
};

export type PlannedCourse = {
  id: number;
  plannerId: number;
  courseId: number | null;
  plannerOptionId: number | null;
  semester: number;
  slot: number;
  course: PlannerCourseDetails;
};

export type Planner = {
  id: number;
  schoolYear: number;
  label: string;
  plannedCourses: PlannedCourse[];
};

export async function getPlanners(): Promise<Planner[]> {
  const response = await fetch(`${API_URL}/api/planner`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch planners");
  }

  return response.json();
}

export async function getPlanner(year: number): Promise<Planner> {
  const planners = await getPlanners();
  const planner = planners.find((p) => p.schoolYear === year);

  if (!planner) {
    throw new Error(`Planner not found for year ${year}`);
  }

  return planner;
}

export async function getPlannerOptions(grade: number): Promise<PlannerOption[]> {
  const response = await fetch(
    `${API_URL}/api/planner/options?grade=${encodeURIComponent(grade)}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch planner options");
  }

  return response.json();
}

export async function addPlannedCourse(
  plannerId: number,
  courseId: number,
  semester: number,
  slot: number
): Promise<Planner>;

export async function addPlannedCourse(
  plannerId: number,
  item: { plannerOptionId: number; semester: number; slot: number }
): Promise<Planner>;

export async function addPlannedCourse(
  plannerId: number,
  courseIdOrItem: number | { plannerOptionId: number; semester: number; slot: number },
  semester?: number,
  slot?: number
): Promise<Planner> {
  const body: Record<string, unknown> = { plannerId };
  if (typeof courseIdOrItem === "number") {
    body.courseId = courseIdOrItem;
    body.semester = semester;
    body.slot = slot;
  } else {
    body.plannerOptionId = courseIdOrItem.plannerOptionId;
    body.semester = courseIdOrItem.semester;
    body.slot = courseIdOrItem.slot;
  }

  const response = await fetch(`${API_URL}/api/planner/courses`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Failed to add course" }));
    throw new Error(data.error || "Failed to add course");
  }

  return response.json();
}

export async function removePlannedCourse(plannedCourseId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/planner/courses/${plannedCourseId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to remove course" }));
    throw new Error(body.error || "Failed to remove course");
  }
}

export async function movePlannedCourse(
  plannedCourseId: number,
  semester: number,
  slot: number
): Promise<Planner> {
  const response = await fetch(`${API_URL}/api/planner/courses/${plannedCourseId}/move`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ semester, slot }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to move course" }));
    throw new Error(body.error || "Failed to move course");
  }

  return response.json();
}

import type { Course } from "@/types/course";

function normalizeDuration(value: unknown): number {
  if (typeof value === "number" && value === 2) return 2;
  if (typeof value === "string") {
    const num = Number(value.trim());
    return num === 2 ? 2 : 1;
  }
  return 1;
}

function deriveCourseDuration(course: Course): number {
  if (course.duration === 2) return 2;
  if (course.duration === 1) return 1;
  const durations =
    course.options?.flatMap((option) => option.offerings?.map((offering) => offering.duration) ?? []) ?? [];
  return durations.some((duration) => normalizeDuration(duration) === 2) ? 2 : 1;
}

export function courseToPlannerDetails(course: Course): PlannerCourseDetails {
  const option = course.options?.[0];
  const offerings = option?.offerings ?? [];

  const prerequisites = new Set<string>();
  for (const offering of offerings) {
    if (Array.isArray(offering.prerequisites)) {
      for (const item of offering.prerequisites) {
        if (typeof item === "string" && item.trim()) {
          prerequisites.add(item.trim());
        }
      }
    }
  }

  let courseCode: string | null = null;
  for (const offering of offerings) {
    if (typeof offering.courseCode === "string" && offering.courseCode) {
      courseCode = offering.courseCode;
      break;
    }
  }

  return {
    id: course.id,
    title: course.title,
    normalizedTitle: course.normalizedTitle ?? null,
    duration: deriveCourseDuration(course),
    creditType: option?.creditType ?? null,
    credits: option?.credits ?? null,
    division: course.department?.division?.name ?? null,
    department: course.department?.name ?? null,
    description: course.description ?? null,
    fulfillsRequirements: Array.isArray(course.fulfillsRequirements)
      ? course.fulfillsRequirements.filter((r): r is string => typeof r === "string")
      : [],
    prerequisites: Array.from(prerequisites),
    courseCode,
  };
}

export function plannerOptionToPlannerDetails(option: PlannerOption): PlannerCourseDetails {
  return {
    id: -option.id,
    title: option.name,
    normalizedTitle: null,
    duration: option.duration,
    creditType: null,
    credits: option.credits,
    division: null,
    department: null,
    description: null,
    fulfillsRequirements: [],
    prerequisites: [],
    courseCode: null,
  };
}

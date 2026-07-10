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

export async function searchPlannerCourses(query: string): Promise<PlannerCourseDetails[]> {
  const response = await fetch(
    `${API_URL}/api/planner/courses?search=${encodeURIComponent(query)}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to search courses");
  }

  return response.json();
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
): Promise<PlannedCourse[]>;

export async function addPlannedCourse(
  plannerId: number,
  item: { plannerOptionId: number; semester: number; slot: number }
): Promise<PlannedCourse[]>;

export async function addPlannedCourse(
  plannerId: number,
  courseIdOrItem: number | { plannerOptionId: number; semester: number; slot: number },
  semester?: number,
  slot?: number
): Promise<PlannedCourse[]> {
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

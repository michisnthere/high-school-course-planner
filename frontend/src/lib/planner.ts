const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type CourseDuration = "Full Year" | "One Semester";

export type PlannerCourseDetails = {
  id: number;
  title: string;
  duration: CourseDuration;
  creditType: string | null;
  credits: number | null;
};

export type PlannedCourse = {
  id: number;
  plannerId: number;
  courseId: number;
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
  const response = await fetch(`${API_URL}/planner`, {
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
    `${API_URL}/planner/courses?search=${encodeURIComponent(query)}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to search courses");
  }

  return response.json();
}

export async function addPlannedCourse(
  plannerId: number,
  courseId: number,
  semester: number,
  slot: number
): Promise<PlannedCourse[]> {
  const response = await fetch(`${API_URL}/planner/courses`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plannerId, courseId, semester, slot }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to add course" }));
    throw new Error(body.error || "Failed to add course");
  }

  return response.json();
}

export async function removePlannedCourse(plannedCourseId: number): Promise<void> {
  const response = await fetch(`${API_URL}/planner/courses/${plannedCourseId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to remove course" }));
    throw new Error(body.error || "Failed to remove course");
  }
}

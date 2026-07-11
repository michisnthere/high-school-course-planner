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
  gradeMin: number | null;
  gradeMax: number | null;
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

export async function addPlannedCourse(
  plannerId: number,
  courseId: number,
  semester: number,
  slot: number
): Promise<PlannedCourse[]> {
  const response = await fetch(`${API_URL}/api/planner/courses`, {
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

function escapeRegExp(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&");
}

export function sortPickerCourses(courses: PlannerCourseDetails[]): PlannerCourseDetails[] {
  if (courses.length <= 1) return [...courses];

  const list = [...courses];
  const byCode = new Map<string, PlannerCourseDetails>();
  for (const course of list) {
    if (course.courseCode) {
      byCode.set(course.courseCode.toLowerCase(), course);
    }
  }

  const titleMatchers = [...list].sort((a, b) => b.title.length - a.title.length);
  const prereqMap = new Map<PlannerCourseDetails, PlannerCourseDetails[]>();

  for (const course of list) {
    const matches = new Set<PlannerCourseDetails>();

    for (const prereqText of course.prerequisites) {
      const normalized = prereqText.toLowerCase();
      if (normalized === "none" || normalized === "n/a") continue;

      for (const candidate of titleMatchers) {
        if (candidate === course) continue;
        if (candidate.title.length === 0) continue;
        const pattern = new RegExp(`\\b${escapeRegExp(candidate.title)}\\b`, "i");
        if (pattern.test(normalized)) {
          matches.add(candidate);
        }
      }

      const codeMatches = normalized.match(/\b[a-z]{3}\d{3}\b/gi);
      for (const code of codeMatches ?? []) {
        const matched = byCode.get(code.toLowerCase());
        if (matched && matched !== course) {
          matches.add(matched);
        }
      }
    }

    prereqMap.set(course, Array.from(matches));
  }

  const memo = new Map<PlannerCourseDetails, number>();
  function computeDepth(
    course: PlannerCourseDetails,
    visiting: Set<PlannerCourseDetails>
  ): number {
    if (memo.has(course)) return memo.get(course)!;
    if (visiting.has(course)) return 0;

    visiting.add(course);
    const prereqs = prereqMap.get(course) ?? [];
    let maxDepth = 0;
    for (const prereq of prereqs) {
      maxDepth = Math.max(maxDepth, computeDepth(prereq, visiting) + 1);
    }
    visiting.delete(course);
    memo.set(course, maxDepth);
    return maxDepth;
  }

  const grades = new Map<PlannerCourseDetails, number>();
  for (const course of list) {
    grades.set(course, course.gradeMin ?? 9);
  }

  return list.sort((a, b) => {
    const gradeA = grades.get(a) ?? 9;
    const gradeB = grades.get(b) ?? 9;
    if (gradeA !== gradeB) return gradeA - gradeB;

    const depthA = computeDepth(a, new Set());
    const depthB = computeDepth(b, new Set());
    if (depthA !== depthB) return depthA - depthB;

    return a.title.localeCompare(b.title);
  });
}

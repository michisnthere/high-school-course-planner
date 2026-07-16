const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

import type { Course } from "@/types/course";
import { normalizePrerequisite } from "@/lib/prerequisiteNormalization";
import { deriveCourseDuration, calculateTotalCredits } from "@/lib/courseCredits";

export type CourseDuration = number;

export type PlannerCourseDetails = {
  id: number;
  title: string;
  normalizedTitle: string | null;
  duration: CourseDuration;
  slotsPerSemester: number;
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
  isNonAcademic: boolean;
  isMarchingBand: boolean;
};

export type PlannerOption = {
  id: number;
  name: string;
  duration: number;
  credits: number;
  availableGrades: number[];
  maxPerYear: number | null;
  isNonAcademic: boolean;
};

export type PlannedCourse = {
  id: number;
  plannerId: number;
  courseId: number | null;
  plannerOptionId: number | null;
  semester: number;
  slot: number;
  slotSpan: number;
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

  const data = await response.json();
  window.dispatchEvent(new Event("planner:changed"));
  return data;
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

  window.dispatchEvent(new Event("planner:changed"));
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

  const data = await response.json();
  window.dispatchEvent(new Event("planner:changed"));
  return data;
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

export function courseToPlannerDetails(course: Course): PlannerCourseDetails {
  const option = course.options?.[0];
  const offerings = option?.offerings ?? [];

  const prerequisites = new Set<string>();
  for (const offering of offerings) {
    if (Array.isArray(offering.prerequisites)) {
      for (const item of offering.prerequisites) {
        if (typeof item === "string" && item.trim()) {
          prerequisites.add(normalizePrerequisite(item.trim()));
        }
      }
    }
  }

  let courseCode: string | null = null;
  let gradeMin: number | null = null;
  let gradeMax: number | null = null;
  for (const offering of offerings) {
    if (typeof offering.courseCode === "string" && offering.courseCode && !courseCode) {
      courseCode = offering.courseCode;
    }
    if (offering.gradeMin != null && (gradeMin === null || offering.gradeMin < gradeMin)) {
      gradeMin = offering.gradeMin;
    }
    if (offering.gradeMax != null && (gradeMax === null || offering.gradeMax > gradeMax)) {
      gradeMax = offering.gradeMax;
    }
  }

  const courseDuration = deriveCourseDuration(course);

  return {
    id: course.id,
    title: course.title,
    normalizedTitle: course.normalizedTitle ?? null,
    duration: courseDuration,
    slotsPerSemester: course.slotsPerSemester ?? 1,
    creditType: option?.creditType ?? null,
    credits: calculateTotalCredits(course),
    division: course.department?.division?.name ?? null,
    department: course.department?.name ?? null,
    description: course.description ?? null,
    fulfillsRequirements: Array.isArray(course.fulfillsRequirements)
      ? course.fulfillsRequirements.filter((r): r is string => typeof r === "string")
      : [],
    prerequisites: Array.from(prerequisites),
    courseCode,
    gradeMin,
    gradeMax,
    isNonAcademic: false,
    isMarchingBand: course.isMarchingBand ?? false,
  };
}

export function plannerOptionToPlannerDetails(option: PlannerOption): PlannerCourseDetails {
  return {
    id: -option.id,
    title: option.name,
    normalizedTitle: null,
    duration: option.duration,
    slotsPerSemester: 1,
    creditType: null,
    credits: option.credits,
    division: null,
    department: null,
    description: null,
    fulfillsRequirements: [],
    prerequisites: [],
    courseCode: null,
    gradeMin: null,
    gradeMax: null,
    isNonAcademic: option.isNonAcademic,
    isMarchingBand: false,
  };
}

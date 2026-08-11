import type { Course } from "@prisma/client";
import { normalizeRequirementNames } from "./requirementsCleanup.js";
import { normalizePrerequisite } from "./prerequisiteNormalization.js";
import { deriveCourseDuration, calculateTotalCredits, effectiveSlotsPerSemester } from "./courseCredits.js";

export type CourseDetails = {
  id: number;
  title: string;
  normalizedTitle: string | null;
  duration: number;
  slotsPerSemester: number;
  creditType: string | null;
  credits: number | null;
  division: string | null;
  department: string | null;
  description: string | null;
  fulfillsRequirements: string[];
  prerequisites: string[];
  courseCode: string | null;
  courseCodeS1: string | null;
  courseCodeS2: string | null;
  gradeMin: number | null;
  gradeMax: number | null;
  isNonAcademic: boolean;
  isMarchingBand: boolean;
  supportsEarlyBird: boolean;
  isRepeatable: boolean;
  isOnline: boolean;
};

export function deriveCourseDetails(
  course: Course & {
    department?: { name: string; division?: { name: string } | null } | null;
    options?: Array<{
      creditType?: string | null;
      credits?: number | null;
      isOnline?: boolean | null;
      offerings?: Array<{
        duration?: string | number | null;
        courseCode?: string | null;
        semesterLabel?: string | null;
        prerequisites?: unknown;
        gradeMin?: number | null;
        gradeMax?: number | null;
      }>;
    }>;
  }
): CourseDetails {
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
  let courseCodeS1: string | null = null;
  let courseCodeS2: string | null = null;
  let gradeMin: number | null = null;
  let gradeMax: number | null = null;
  for (const offering of offerings) {
    if (typeof offering.courseCode === "string" && offering.courseCode) {
      if (!courseCode) courseCode = offering.courseCode;
      const sem = offering.semesterLabel ?? "";
      if (sem.startsWith("S1") || sem === "1" || sem.toLowerCase().includes("semester 1")) {
        if (!courseCodeS1) courseCodeS1 = offering.courseCode;
      } else if (sem.startsWith("S2") || sem === "2" || sem.toLowerCase().includes("semester 2")) {
        if (!courseCodeS2) courseCodeS2 = offering.courseCode;
      } else if (!courseCodeS1) {
        courseCodeS1 = offering.courseCode;
      } else if (!courseCodeS2) {
        courseCodeS2 = offering.courseCode;
      }
    }
    if (offering.gradeMin != null && (gradeMin === null || offering.gradeMin < gradeMin)) {
      gradeMin = offering.gradeMin;
    }
    if (offering.gradeMax != null && (gradeMax === null || offering.gradeMax > gradeMax)) {
      gradeMax = offering.gradeMax;
    }
  }

  return {
    id: course.id,
    title: course.title,
    normalizedTitle: course.normalizedTitle ?? null,
    duration: deriveCourseDuration(course),
    slotsPerSemester: effectiveSlotsPerSemester(course),
    creditType: option?.creditType ?? null,
    credits: calculateTotalCredits(course),
    division: course.department?.division?.name ?? null,
    department: course.department?.name ?? null,
    description: course.description ?? null,
    fulfillsRequirements: Array.isArray(course.fulfillsRequirements) ? normalizeRequirementNames(course.fulfillsRequirements.filter((r): r is string => typeof r === "string")) : [],
    prerequisites: Array.from(prerequisites),
    courseCode,
    courseCodeS1,
    courseCodeS2,
    gradeMin,
    gradeMax,
    isNonAcademic: false,
    isMarchingBand: course.isMarchingBand ?? false,
    supportsEarlyBird:
      course.supportsEarlyBird === true ||
      (Array.isArray(course.attributes) && course.attributes.includes("supportsEarlyBird")),
    isRepeatable: course.isRepeatable === true,
    isOnline: (course.options ?? []).some((o) => o.isOnline === true),
  };
}
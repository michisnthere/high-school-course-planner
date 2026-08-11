import type { Course } from "@prisma/client";
import { normalizePrerequisite } from "./prerequisiteNormalization.js";
import { normalizeRequirementNames } from "./requirementsCleanup.js";
import { deriveCourseDetails } from "./courseDetails.js";

export type SummerCourseForDetails = {
  id: number;
  key: string;
  title: string;
  courseCode: string | null;
  creditStatus: string;
  credits: number | null;
  gradeLevels: number[];
  duration: string;
  prerequisites: unknown;
  fulfillsRequirements: unknown;
  isSummerOnly: boolean;
  regularCourseId: number | null;
  matchedTitle: string | null;
  matchedCourseCode: string | null;
  matchConfidence: string | null;
  regularCourse?:
    | (Course & {
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
      })
    | null;
};

export type SummerCourseDetails = {
  id: number;
  key: string;
  title: string;
  courseCode: string | null;
  creditStatus: string;
  credits: number | null;
  gradeLevels: number[];
  duration: string;
  prerequisites: string[];
  fulfillsRequirements: string[];
  isSummerOnly: boolean;
  regularCourseId: number | null;
  matchedTitle: string | null;
  matchedCourseCode: string | null;
  matchConfidence: string | null;
  regularCourse: ReturnType<typeof deriveCourseDetails> | null;
};

export function deriveSummerCourseDetails(
  course: SummerCourseForDetails
): SummerCourseDetails {
  return {
    id: course.id,
    key: course.key,
    title: course.title,
    courseCode: course.courseCode ?? null,
    creditStatus: course.creditStatus,
    credits: course.credits ?? null,
    gradeLevels: course.gradeLevels ?? [],
    duration: course.duration,
    prerequisites: Array.isArray(course.prerequisites)
      ? course.prerequisites
          .filter((p): p is string => typeof p === "string" && !!p.trim())
          .map((p) => normalizePrerequisite(p.trim()))
      : [],
    fulfillsRequirements: Array.isArray(course.fulfillsRequirements)
      ? normalizeRequirementNames(
          course.fulfillsRequirements
            .filter((r): r is string => typeof r === "string")
        )
      : [],
    isSummerOnly: course.isSummerOnly,
    regularCourseId: course.regularCourseId,
    matchedTitle: course.matchedTitle,
    matchedCourseCode: course.matchedCourseCode,
    matchConfidence: course.matchConfidence,
    regularCourse: course.regularCourse ? deriveCourseDetails(course.regularCourse) : null,
  };
}
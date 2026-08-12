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
  corequisites: unknown;
  fulfillsRequirements: unknown;
  isSummerOnly: boolean;
  regularCourseId: number | null;
  matchedTitle: string | null;
  matchedCourseCode: string | null;
  matchConfidence: string | null;
  description?: string | null;
  notes?: unknown;
  sourcePage?: number | null;
  sourceReference?: string | null;
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
  corequisites: string[];
  fulfillsRequirements: string[];
  isSummerOnly: boolean;
  regularCourseId: number | null;
  matchedTitle: string | null;
  matchedCourseCode: string | null;
  matchConfidence: string | null;
  description: string | null;
  notes: string[];
  sourcePage: number | null;
  sourceReference: string | null;
  division: string | null;
  instructionalCreditType: string | null;
  attributes: string[];
  regularCourse: ReturnType<typeof deriveCourseDetails> | null;
};

function deriveSummerOnlyDivision(course: SummerCourseForDetails): string | null {
  const text = [
    course.title,
    ...(Array.isArray(course.fulfillsRequirements) ? course.fulfillsRequirements : []),
    ...(Array.isArray(course.notes) ? course.notes : []),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (/\b(english|reading|writing|essay|eld|oracy|literacy)\b/.test(text)) return "Communication Arts";
  if (/\b(art|theatre|music|photography)\b/.test(text)) return "Fine Arts";
  if (/\b(algebra|geometry|math|mth)\b/.test(text)) return "Mathematics";
  if (/\b(science|stem|healthcare|medicine|astronomy|biotechnology)\b/.test(text)) return "Science";
  if (/\b(history|government|economics|law|social studies)\b/.test(text)) return "Social Studies";
  if (/\b(health education|driver education|physical education|fitness|preparing for life)\b/.test(text)) return "Physical Welfare";
  if (/\b(business|technology|programming|computer|csc|bus|careers)\b/.test(text)) return "Applied Arts";
  return null;
}

function deriveInstructionalCreditType(course: SummerCourseForDetails): string | null {
  const regularType = course.regularCourse?.options?.find((option) => option.creditType)?.creditType ?? null;
  if (regularType) return regularType;

  const text = [
    course.title,
    ...(Array.isArray(course.notes) ? course.notes : []),
    ...(Array.isArray(course.prerequisites) ? course.prerequisites : []),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (/\bap\b|advanced placement/.test(text)) return "AP";
  if (/honors/.test(text)) return "Honors";
  if (/accelerated/.test(text)) return "Accelerated";
  return null;
}

function deriveSummerAttributes(course: SummerCourseForDetails): string[] {
  const attrs = new Set<string>();
  const notes = Array.isArray(course.notes)
    ? course.notes.filter((note): note is string => typeof note === "string")
    : [];
  for (const note of notes) {
    const lower = note.toLowerCase();
    if (lower.includes("pass/fail")) attrs.add("Pass/Fail");
    if (lower.includes("gpa waiver")) attrs.add("GPA Waiver Option");
    if (lower.includes("non-credit")) attrs.add("Non-credit");
    if (lower.includes("accelerated option")) attrs.add("Accelerated Option Available");
  }
  if (course.duration === "full_summer") attrs.add("Full Summer");
  return Array.from(attrs);
}

export function deriveSummerCourseDetails(
  course: SummerCourseForDetails
): SummerCourseDetails {
  const regularCourse = course.regularCourse ? deriveCourseDetails(course.regularCourse) : null;
  const notes = Array.isArray(course.notes)
    ? course.notes.filter((note): note is string => typeof note === "string" && !!note.trim())
    : [];

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
    corequisites: Array.isArray(course.corequisites)
      ? course.corequisites
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
    description: course.description ?? null,
    notes,
    sourcePage: course.sourcePage ?? null,
    sourceReference: course.sourceReference ?? null,
    division: regularCourse?.division ?? deriveSummerOnlyDivision(course),
    instructionalCreditType: deriveInstructionalCreditType(course),
    attributes: deriveSummerAttributes(course),
    regularCourse,
  };
}

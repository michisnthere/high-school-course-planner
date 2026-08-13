import type { PlannerCourseDetails } from "./planner";

// One printed "CODE: DATES" + "TIME" block from the Summer School coursebook.
export type SummerMeeting = {
  courseCode?: string | null;
  dates?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

// Frontend mirror of the backend SummerCourse model (backend/prisma/schema.prisma).
// Summer School data lives in dedicated tables and never mutates the regular
// catalog. A SummerCourse may link to its matched regular course via
// `regularCourse` (exact title/code match only, never altering the Course row).
export type SummerCourse = {
  id: number;
  key: string;
  title: string;
  courseCode: string | null;
  description: string | null;
  creditStatus: "credit" | "non-credit" | "unknown" | string;
  credits: number | null;
  creditType?: string | null;
  duration: "one_session" | "full_summer" | string;
  durationNote?: string | null;
  cost?: string | null;
  meetings?: SummerMeeting[];
  prerequisites: string[];
  corequisites?: string[];
  fulfillsRequirements: string[];
  isSummerOnly: boolean;
  division: string | null;
  instructionalCreditType: string | null;
  attributes: string[];
  notes: string[];
  sourcePage: number | null;
  sourceReference: string | null;
  regularCourseId: number | null;
  regularCourse: PlannerCourseDetails | null;
  matchedTitle?: string | null;
  matchedCourseCode?: string | null;
  gradeLevels?: number[];
  sessions?: string[];
  requirement?: Array<{ sourceName: string; graduationRequirement: { id: number; name: string } }>;
};

const API_URL = typeof window === "undefined" ? (process.env.BACKEND_URL || "http://localhost:4000") : "";

export async function getSummerCourses(): Promise<SummerCourse[]> {
  const response = await fetch(`${API_URL}/api/summer-courses`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch summer courses");
  }

  return response.json();
}

/** Session vocabulary: Session 1 maps to Summer School Semester 1 (code 3),
 * Session 2 to Semester 2 (code 4). */
export function summerSessionForSemester(semester: number): string {
  return semester === 4 ? "Session 2" : "Session 1";
}

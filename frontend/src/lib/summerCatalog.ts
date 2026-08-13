import type { Course } from "@/types/course";
import type { SummerCourse, SummerMeeting } from "@/lib/summerCourse";
import { normalizeTitle } from "@/lib/normalize";
import { formatCredits } from "@/lib/courseCredits";

export const CATALOG_CREDIT_TYPES = ["Accelerated", "College Prep", "AP", "Honors"] as const;
export const CATALOG_GRADE_LEVELS = [9, 10, 11, 12] as const;
export const CATALOG_SEMESTERS = ["1", "2"] as const;

export type CatalogCreditType = (typeof CATALOG_CREDIT_TYPES)[number];

const SUMMER_ACRONYMS = new Set([
  "AB",
  "ACT",
  "AED",
  "AP",
  "BC",
  "CPR",
  "DSLR",
  "ELD",
  "GPA",
  "SAT",
  "STEM",
  "TOEFL",
  "U.S.",
]);

const SUMMER_TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

/**
 * The Summer School coursebook is printed entirely in upper case, and the
 * imported titles keep that exact case. Convert all-caps titles to display
 * title case while preserving acronyms (ACT, AP, ELD, U.S.) and codes
 * (AB/BC). Mixed-case titles pass through unchanged.
 */
export function normalizeSummerTitle(title: string | null | undefined): string {
  const source = (title ?? "").trim();
  if (!source) return source;
  if (source !== source.toUpperCase()) return source;

  const words = source.split(/\s+/);
  return words
    .map((word, index) => {
      if (word.includes(".")) return word;
      const upper = word.toUpperCase();
      if (SUMMER_ACRONYMS.has(upper)) return upper;
      if (/^\d+$/.test(word)) return word;
      const segments = word.split("/");
      if (segments.length > 1 && segments.every((segment) => /^[A-Z0-9]+$/.test(segment) && segment.length <= 4)) {
        return word;
      }
      const lower = word.toLowerCase();
      if (index > 0 && SUMMER_TITLE_STOP_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function summerCourseSlug(course: SummerCourse): string {
  return course.key || normalizeTitle(course.title);
}

export function summerSessionToSemester(session: string): "1" | "2" | null {
  // Summer School keeps "Session 1" / "Session 2" in the database. The shared
  // catalog UI labels those filter buckets as Semester 1 / Semester 2.
  if (session === "Session 1") return "1";
  if (session === "Session 2") return "2";
  return null;
}

export function formatSummerCredits(course: SummerCourse): string {
  if (course.creditStatus === "non-credit") return "Non-credit";
  if (course.credits != null) {
    const number = formatCredits(course.credits);
    return `${number} ${course.credits === 1 ? "credit" : "credits"}`;
  }
  if (course.creditStatus === "unknown") return "Credit unknown";
  return "Credit";
}

export function formatSummerCreditType(course: SummerCourse): string {
  if (course.creditStatus === "non-credit") return "Non-credit";
  if (course.creditStatus === "unknown") return "Credit unknown";
  return "Credit";
}

export function formatSummerGrades(course: SummerCourse): string | null {
  const grades = [...(course.gradeLevels ?? [])].sort((a, b) => a - b);
  if (grades.length === 0) return null;
  if (grades.length === 1) return `Grade ${grades[0]}`;
  return `Grades ${grades.join(", ")}`;
}

export function formatSummerSessions(course: SummerCourse): string | null {
  const semesters = (course.sessions ?? [])
    .map(summerSessionToSemester)
    .filter((value): value is "1" | "2" => value != null);
  if (semesters.length === 0) return null;
  return `Semester ${[...new Set(semesters)].join("/")}`;
}

export function normalizeSummerCourseForCatalog(course: SummerCourse): Course {
  const division = course.division ?? "Summer School";
  const creditType = formatSummerCreditType(course);
  const gradeLevels = course.gradeLevels ?? [];

  return {
    id: -course.id,
    title: normalizeSummerTitle(course.title),
    courseCode: course.courseCode,
    normalizedTitle: summerCourseSlug(course),
    description: course.description,
    notes: course.notes,
    attributes: [],
    fulfillsRequirements: course.fulfillsRequirements,
    catalogMeta: [],
    department: {
      name: division,
      division: { name: division },
    },
    options: [
      {
        creditType,
        credits: course.credits,
        offerings: (course.sessions ?? []).map((session) => ({
          courseCode: course.courseCode ?? "",
          semesterLabel: summerSessionToSemester(session) ?? session,
          duration: course.duration === "full_summer" ? "2" : "1",
          gradeMin: gradeLevels.length > 0 ? Math.min(...gradeLevels) : null,
          gradeMax: gradeLevels.length > 0 ? Math.max(...gradeLevels) : null,
          credits: course.credits,
          prerequisites: course.prerequisites,
          corequisites: course.corequisites,
        })),
      },
    ],
  };
}

export function findSummerCourseBySlug(courses: SummerCourse[], slug: string): SummerCourse | undefined {
  return courses.find((course) => summerCourseSlug(course) === slug || normalizeTitle(course.title) === slug);
}

const COST_NOTE_PATTERN = /^\s*cost(?:\s*[:.])?/i;
const SCHEDULE_NOTE_PATTERN =
  /\b(?:a\.?m\.?|p\.?m\.?|m-f)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{1,2}\b|\b\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)\b/i;
const PASS_FAIL_NOTE_PATTERN = /pass\s*\/\s*fail|pass.?fail/i;
const DURATION_NOTE_PATTERN =
  /\b\d+\s*-?\s*day\b|\b(?:two|three|four|five|six|seven|eight|one)-week\b|\bone\s*-?\s*semester\b/i;

function summerNotes(course: SummerCourse): string[] {
  return (course.notes ?? []).filter((note): note is string => typeof note === "string" && note.trim().length > 0);
}

export function isSummerCostNote(note: string): boolean {
  return COST_NOTE_PATTERN.test(note);
}

export function isSummerScheduleNote(note: string): boolean {
  return SCHEDULE_NOTE_PATTERN.test(note);
}

export function isSummerPassFailNote(note: string): boolean {
  return PASS_FAIL_NOTE_PATTERN.test(note);
}

/** Printed meeting blocks, each mirroring one "CODE: DATES" + "TIME" cluster. */
export function getSummerMeetings(course: SummerCourse): SummerMeeting[] {
  return (course.meetings ?? []).filter(
    (meeting): meeting is SummerMeeting => typeof meeting === "object" && meeting !== null
  );
}

/** Distinct dates printed across the course's meetings, joined for display. */
export function formatSummerDates(course: SummerCourse): string | null {
  const dates = [...new Set(getSummerMeetings(course).map((m) => m.dates?.trim()).filter(Boolean) as string[])];
  return dates.length > 0 ? dates.join(", ") : null;
}

/** Distinct time ranges printed across the course's meetings, joined for display. */
export function formatSummerTimes(course: SummerCourse): string | null {
  const times = [
    ...new Set(
      getSummerMeetings(course)
        .map((m) => (m.startTime && m.endTime ? `${m.startTime} – ${m.endTime}` : null))
        .filter(Boolean) as string[]
    ),
  ];
  return times.length > 0 ? times.join(", ") : null;
}

/** Cost line(s) printed in the coursebook, shown only when present. */
export function getSummerCost(course: SummerCourse): string | null {
  const structured = course.cost?.trim();
  if (structured) return structured;
  const costs = summerNotes(course).filter((note) => isSummerCostNote(note));
  return costs.length > 0 ? costs.join(" ") : null;
}

/** Date/time availability line(s) printed in the coursebook (legacy fallback). */
export function getSummerScheduleNotes(course: SummerCourse): string[] {
  return summerNotes(course).filter((note) => isSummerScheduleNote(note));
}

/** True when the coursebook marks the course as Pass/Fail. */
export function getSummerPassFail(course: SummerCourse): boolean {
  return (
    (course.creditType ?? "").toLowerCase().includes("pass/fail") ||
    (course.attributes ?? []).some((attribute) => PASS_FAIL_NOTE_PATTERN.test(attribute)) ||
    (course.notes ?? []).some((note) => isSummerPassFailNote(note))
  );
}

/** Grade levels as a compact "open to" string, e.g. "10-11-12". */
export function formatSummerOpenTo(course: SummerCourse): string | null {
  const grades = [...(course.gradeLevels ?? [])].sort((a, b) => a - b);
  return grades.length > 0 ? grades.join("-") : null;
}

/** Session names as printed, e.g. "Session 1" or "Session 1 / Session 2". */
export function formatSummerSessionsRaw(course: SummerCourse): string | null {
  const sessions = [...new Set(course.sessions ?? [])];
  return sessions.length > 0 ? sessions.join(" / ") : null;
}

/** Duration label: printed phrase when available, else derived from the data. */
export function getSummerDurationLabel(course: SummerCourse): string {
  const printed = course.durationNote?.trim();
  if (printed) return printed;
  if (course.duration === "full_summer") return "Full Summer";
  for (const note of summerNotes(course)) {
    const match = note.match(DURATION_NOTE_PATTERN);
    if (match) {
      const phrase = match[0];
      return phrase.charAt(0).toUpperCase() + phrase.slice(1);
    }
  }
  return "One Session";
}

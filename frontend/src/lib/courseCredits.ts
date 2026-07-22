import type { PlannedCourse } from "./planner";

export function deriveCourseDuration(course: {
  duration?: number | null;
  options?: Array<{
    offerings?: Array<{ duration?: string | number | null }>;
  }> | null;
}): number {
  if (course.duration === 2) return 2;
  if (course.duration === 1) return 1;

  const hasFullYear = course.options?.some((option) =>
    option.offerings?.some((offering) => {
      const value = offering.duration;
      if (typeof value === "number") return value === 2;
      if (typeof value === "string") return Number(value.trim()) === 2;
      return false;
    })
  );
  return hasFullYear ? 2 : 1;
}

export function calculateTotalCredits(course: {
  options?: Array<{
    credits?: number | null;
    offerings?: Array<{ duration?: string | number | null; credits?: number | null }>;
  }> | null;
  duration?: number | null;
}): number {
  const option = course.options?.[0];
  if (option?.credits != null) {
    const semesters = deriveCourseDuration(course) === 2 ? 2 : 1;
    return option.credits * semesters;
  }

  if (option?.offerings?.[0]?.credits != null) {
    const semesters = deriveCourseDuration(course) === 2 ? 2 : 1;
    return option.offerings[0].credits * semesters;
  }

  const duration = deriveCourseDuration(course);
  return duration === 2 ? 2 : 1;
}

function getSemesterCreditsFromTotal(totalCredits: number, duration: number): number {
  return duration === 2 ? totalCredits / 2 : totalCredits;
}

/** Total credits for a course entity (full-year = 2, semester = 1) */
export function getCourseCredits(course: {
  credits?: number | null;
  duration?: number | null;
  options?: Array<{
    credits?: number | null;
    offerings?: Array<{ duration?: string | number | null }>;
  }> | null;
}): number {
  return calculateTotalCredits(course);
}

/** Deduplication key for a planned course placement.
 *  Full-year courses share one key (courseId+slot); semester courses are unique per semester+slot. */
export function getPlacementKey(pc: {
  courseId?: number | null;
  course?: { duration?: number | null };
  slot?: number | null;
  semester?: number | null;
}): string {
  if (pc.course?.duration === 2) {
    return `fy:${pc.courseId}`;
  }
  return `sem:${pc.courseId}:${pc.slot}:${pc.semester}`;
}

/** Deduplicate a PlannedCourse array, returning one entry per full-year course */
export function dedupePlannedCourses(pcs: PlannedCourse[]): PlannedCourse[] {
  const seen = new Set<string>();
  const result: PlannedCourse[] = [];
  for (const pc of pcs) {
    const key = getPlacementKey(pc);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(pc);
  }
  return result;
}

/** Sum total credits across PlannedCourse[], deduplicating full-year courses */
export function sumPlannedCredits(pcs: PlannedCourse[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const pc of pcs) {
    const key = getPlacementKey(pc);
    if (seen.has(key)) continue;
    seen.add(key);
    total += getCourseCredits(pc.course);
  }
  return total;
}

/** Per-semester credit value: full-year splits evenly, semester is full value in its semester */
export function getSemesterCredits(pc: {
  course: { credits?: number | null; duration?: number | null; options?: Array<{ credits?: number | null; offerings?: Array<{ duration?: string | number | null; credits?: number | null }> }> | null };
}): number {
  const totalCredits = getCourseCredits(pc.course);
  const duration = deriveCourseDuration(pc.course);
  return getSemesterCreditsFromTotal(totalCredits, duration);
}

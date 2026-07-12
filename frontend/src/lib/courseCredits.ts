import type { PlannedCourse } from "./planner";

/** Total credits for a course entity (full-year = 2, semester = 1) */
export function getCourseCredits(course: {
  credits?: number | null;
  duration?: number | null;
}): number {
  return course.credits ?? course.duration ?? 1;
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
    return `fy:${pc.courseId}:${pc.slot}`;
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

/** Per-semester credit value: full-year splits evenly (2 → 1+1), semester is full value in its semester */
export function getSemesterCredits(pc: PlannedCourse): number {
  if (pc.course.duration === 2) {
    return getCourseCredits(pc.course) / 2;
  }
  return getCourseCredits(pc.course);
}

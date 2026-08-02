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

/** Display a credit value as a whole number when it is an integer, preserving fractional values. */
export function formatCredits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
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

// A 1.5-period science course (e.g. AP Physics 1, AP Biology, AP Chemistry,
// AP Physics C) carries 1.5 credits per offering but only occupies a single
// planner slot. Slot occupancy, credit value, and Early Bird status are
// independent concepts; only slot occupancy is normalized here.
type CourseLike = {
  description?: string | null;
  division?: string | null;
  department?: string | { name?: string | null; division?: { name?: string | null } | null } | null;
  options?: Array<Record<string, unknown>> | null;
  slotsPerSemester?: number | null;
};

function divisionOf(course: CourseLike): string {
  if (typeof course.department === "object" && course.department != null) {
    return (course.department.division?.name ?? "").toLowerCase().trim();
  }
  return (course.division ?? "").toLowerCase().trim();
}

export function isOnePointFivePeriodScienceCourse(course: CourseLike): boolean {
  if (divisionOf(course) !== "science") return false;
  if ((course.description ?? "").toLowerCase().includes("1.5 period")) return true;
  return (course.options ?? []).some((o) => {
    const credits = o.credits;
    return typeof credits === "number" && credits > 1 && credits < 2;
  });
}

export function effectiveSlotsPerSemester(course: CourseLike): number {
  return isOnePointFivePeriodScienceCourse(course) ? 1 : (course.slotsPerSemester ?? 1);
}

/** Effective slot span of a planned course, normalizing 1.5-period sciences to one slot. */
export function effectiveSlotSpan(pc: {
  slotSpan?: number | null;
  course: CourseLike;
}): number {
  if (isOnePointFivePeriodScienceCourse(pc.course)) return 1;
  return pc.slotSpan ?? pc.course.slotsPerSemester ?? 1;
}

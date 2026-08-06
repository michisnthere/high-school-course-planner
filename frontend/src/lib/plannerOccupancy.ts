import type { Planner, PlannedCourse } from "./planner";
import { effectiveSlotSpan } from "./courseCredits";
import { isRegularSemester, SUMMER_SEMESTER, ONLINE_SEMESTER } from "./plannerSemesters";

export const SLOTS_PER_SEMESTER = 7;
export const TOTAL_PLANNER_SLOTS = SLOTS_PER_SEMESTER * 2;

export type PlannerOccupancy = {
  /** Number of occupied slots across both regular semesters (multi-slot courses count their full span). */
  occupiedSlots: number;
  /** Alias of occupiedSlots for the "X / totalSlots" display. */
  filledSlots: number;
  /** Remaining free regular-semester slots. */
  availableSlots: number;
  /** Total regular-semester slots in a year planner. */
  totalSlots: number;
  /** Distinct planned courses (full-year and repeated courses counted once). */
  plannedCount: number;
  /** Distinct full-year courses. */
  fullYearCount: number;
  /** Distinct one-semester courses. */
  semesterCount: number;
  /** Distinct Early Bird courses (each still occupies a single slot). */
  earlyBirdCount: number;
  /** Distinct courses whose effective slot span is greater than one period. */
  multiSlotCount: number;
  /** Summer school course count (excluded from regular-semester slot math). */
  summerCourseCount: number;
  /** Online course count (excluded from regular-semester slot math). */
  onlineCourseCount: number;
  /** Occupied period numbers per regular semester. */
  occupiedPeriods: Record<number, number[]>;
};

function courseIdentityKey(pc: PlannedCourse): string | null {
  if (pc.courseId != null) return `c${pc.courseId}`;
  if (pc.plannerOptionId != null) return `o${pc.plannerOptionId}`;
  return `i${pc.id}`;
}

export function calculatePlannerOccupancy(planner: Planner): PlannerOccupancy {
  const regularCourses = planner.plannedCourses.filter((pc) => isRegularSemester(pc.semester));
  const summerCourses = planner.plannedCourses.filter((pc) => pc.semester === SUMMER_SEMESTER);
  const onlineCourses = planner.plannedCourses.filter((pc) => pc.semester === ONLINE_SEMESTER);

  const identities = new Set<string>();
  const fullYearIds = new Set<string>();
  const earlyBirdIds = new Set<string>();
  const multiSlotIds = new Set<string>();
  const occupiedPeriods: Record<number, Set<number>> = { 1: new Set(), 2: new Set() };

  let occupiedSlots = 0;
  for (const pc of regularCourses) {
    const span = effectiveSlotSpan(pc);
    occupiedSlots += span;

    const identity = courseIdentityKey(pc);
    if (identity) {
      identities.add(identity);
      if (pc.course.duration === 2) fullYearIds.add(identity);
      if (pc.isEarlyBird) earlyBirdIds.add(identity);
      if (span > 1) multiSlotIds.add(identity);
    }

    const semesterSet = occupiedPeriods[pc.semester];
    if (semesterSet) {
      for (let i = 0; i < span; i++) semesterSet.add(pc.slot + i);
    }
  }

  const plannedCount = identities.size;

  return {
    occupiedSlots,
    filledSlots: occupiedSlots,
    availableSlots: Math.max(0, TOTAL_PLANNER_SLOTS - occupiedSlots),
    totalSlots: TOTAL_PLANNER_SLOTS,
    plannedCount,
    fullYearCount: fullYearIds.size,
    semesterCount: plannedCount - fullYearIds.size,
    earlyBirdCount: earlyBirdIds.size,
    multiSlotCount: multiSlotIds.size,
    summerCourseCount: summerCourses.length,
    onlineCourseCount: onlineCourses.length,
    occupiedPeriods: {
      1: Array.from(occupiedPeriods[1]).sort((a, b) => a - b),
      2: Array.from(occupiedPeriods[2]).sort((a, b) => a - b),
    },
  };
}

/**
 * Completion percentage based on occupied regular-semester slots (not course
 * records). Multi-slot courses count their full span; summer courses are ignored.
 * Returns a rounded integer in the range 0-100.
 */
export function calculatePlannerCompletionPercentage(planner: Planner): number {
  const { occupiedSlots, totalSlots } = calculatePlannerOccupancy(planner);
  if (totalSlots <= 0) return 0;
  return Math.min(100, Math.round((occupiedSlots / totalSlots) * 100));
}

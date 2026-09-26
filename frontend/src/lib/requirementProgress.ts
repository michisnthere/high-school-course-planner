// Graduation-requirement progress representation.
//
// The graduation/planner analysis system (`plannerAnalysisEngine.ts` for guest
// mode, `backend/src/lib/plannerAnalysis.ts` for authenticated mode) is the
// single source of truth for how much of a requirement is satisfied:
//   - `completedValue` counts only coursework the student has actually completed
//   - `plannedValue` counts qualifying courses planned for a future year that
//     are not yet completed (projected value minus completed value)
//
// The helpers here only normalize those already-computed values for display
// (clamping to the requirement total, splitting into segments, deriving a
// status tag). They never re-derive requirement credit allocations, so the
// requirement's own unit (credits, course counts, requirement-specific value)
// is always used as-is — no conversions are introduced.

export type RequirementProgressSegments = {
  totalValue: number;
  completedValue: number;
  plannedValue: number;
  remainingValue: number;
  green: number;
  yellow: number;
  gray: number;
};

export type RequirementDisplayStatus = "satisfied" | "partial" | "notStarted" | "planned";

function toSafeValue(value: number | null | undefined): number {
  return Number.isFinite(value ?? 0) ? Number(value ?? 0) : 0;
}

/**
 * Splits a requirement into completed / planned / remaining segments.
 *
 * green  = value satisfied by completed courses
 * yellow = additional value projected to be satisfied by planned, incomplete
 *          courses (never overlapping the completed portion, never exceeding
 *          the requirement total)
 * gray   = value neither completed nor planned
 */
export function computeRequirementSegments(
  totalValue: number | null | undefined,
  completedValue: number | null | undefined,
  plannedValue: number | null | undefined,
): RequirementProgressSegments {
  const total = Math.max(0, toSafeValue(totalValue));
  const completed = Math.min(Math.max(0, toSafeValue(completedValue)), total);
  const planned = Math.min(Math.max(0, toSafeValue(plannedValue)), Math.max(0, total - completed));
  const remaining = Math.max(0, total - completed - planned);

  return {
    totalValue: total,
    completedValue: completed,
    plannedValue: planned,
    remainingValue: remaining,
    green: completed,
    yellow: planned,
    gray: remaining,
  };
}

/**
 * Status tag for a requirement card.
 *
 * A requirement is only "satisfied" when completed coursework covers the full
 * required value — a projected four-year plan alone never marks it complete.
 * When unmet value would be covered by planned (incomplete) courses, the
 * requirement is tagged "Planned" instead of "Partial".
 */
export function computeRequirementDisplayStatus(
  totalValue: number | null | undefined,
  completedValue: number | null | undefined,
  plannedValue: number | null | undefined,
): RequirementDisplayStatus {
  const segments = computeRequirementSegments(totalValue, completedValue, plannedValue);
  if (segments.completedValue >= segments.totalValue) return "satisfied";
  if (segments.plannedValue > 0) return "planned";
  if (segments.completedValue > 0) return "partial";
  return "notStarted";
}

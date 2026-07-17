import type { Planner } from "./planner";
import type { CompletedCourse } from "./completedCourses";
import type { RequirementResolution } from "./api";

export function hasGuestProgress(
  planners: Planner[],
  completedCourses: CompletedCourse[],
  savedCourseIds: number[],
  resolutions: RequirementResolution[]
): boolean {
  return (
    planners.some((p) => p.plannedCourses.length > 0) ||
    completedCourses.length > 0 ||
    savedCourseIds.length > 0 ||
    resolutions.length > 0
  );
}

export async function migrateGuestDataToUser(): Promise<void> {
  return;
}

import type { Planner } from "@/lib/planner";
import type { CompletedCourse } from "@/lib/completedCourses";

// Shared, in-memory backing store for the guest services. Sharing a single
// instance between the planner and completed-courses services lets "mark year
// completed" record the year's courses as completed (matching the authenticated
// experience) so graduation credits are not lost when a year is finalized.
export type GuestDataStore = {
  planners: Planner[];
  completedCourses: CompletedCourse[];
  completedIdSeq: number;
};

export function createGuestDataStore(): GuestDataStore {
  return {
    planners: [],
    completedCourses: [],
    completedIdSeq: 0,
  };
}
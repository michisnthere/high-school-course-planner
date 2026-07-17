import type { Planner, PlannerCourseDetails } from "./planner";
import type { CompletedCourse } from "./completedCourses";
import type { RequirementResolution } from "./api";

export type StudentPlanningData = {
  planners: Planner[];
  completedCourses: CompletedCourse[];
  resolutions: RequirementResolution[];
  allCourses: PlannerCourseDetails[];
};

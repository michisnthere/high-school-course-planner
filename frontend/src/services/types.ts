import type { Planner, PlannerCourseDetails, PlannerOption } from "@/lib/planner";
import type { CompletedCourse, GradeCompleted } from "@/lib/completedCourses";

export interface IPlannerService {
  getPlanners(): Promise<Planner[]>;
  getPlanner(year: number): Promise<Planner>;
  getPlannerOptions(grade: number): Promise<PlannerOption[]>;
  searchPlannerCourses(query: string): Promise<PlannerCourseDetails[]>;
  addPlannedCourse(plannerId: number, courseId: number, semester: number, slot: number): Promise<Planner>;
  addPlannedCourse(plannerId: number, item: { plannerOptionId: number; semester: number; slot: number }): Promise<Planner>;
  removePlannedCourse(plannedCourseId: number): Promise<void>;
  movePlannedCourse(plannedCourseId: number, semester: number, slot: number): Promise<Planner>;
}

export interface ICompletedCoursesService {
  getCompletedCourses(): Promise<CompletedCourse[]>;
  addCompletedCourse(courseId: number, gradeCompleted: GradeCompleted, letterGrade?: string | null): Promise<CompletedCourse>;
  updateCompletedCourse(id: number, updates: { letterGrade?: string | null; gradeCompleted?: GradeCompleted }): Promise<CompletedCourse>;
  removeCompletedCourse(id: number): Promise<void>;
}

export interface ISavedCoursesService {
  getSavedCourseIds(): Promise<number[]>;
  saveCourse(courseId: number): Promise<void>;
  removeSavedCourse(courseId: number): Promise<void>;
}

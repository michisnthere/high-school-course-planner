import type { Planner, PlannerCourseDetails, PlannerOption } from "@/lib/planner";
import type { SummerCourse } from "@/lib/summerCourse";
import type { CompletedCourse, CompletedCourseInput, GradeCompleted } from "@/lib/completedCourses";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";
import type { StudentPlanningData } from "@/lib/studentData";
import type { RequirementResolution } from "@/lib/api";

export interface IPlannerService {
  seedCourseCatalog(courses: PlannerCourseDetails[]): void;
  getPlanners(): Promise<Planner[]>;
  getPlanner(year: number): Promise<Planner>;
  getPlannerOptions(grade: number): Promise<PlannerOption[]>;
  searchPlannerCourses(query: string): Promise<PlannerCourseDetails[]>;
  addPlannedCourse(plannerId: number, courseId: number, semester: number, slot: number, isEarlyBird?: boolean): Promise<Planner>;
  addPlannedCourse(plannerId: number, item: { plannerOptionId: number; semester: number; slot: number; isEarlyBird?: boolean }): Promise<Planner>;
  addSummerCourse(plannerId: number, summerCourse: SummerCourse, semester: number): Promise<Planner>;
  removePlannedCourse(plannedCourseId: number): Promise<void>;
  movePlannedCourse(plannedCourseId: number, semester: number, slot: number): Promise<Planner>;
  updateEarlyBird(plannedCourseId: number, isEarlyBird: boolean): Promise<Planner>;
  markYearCompleted(plannerId: number): Promise<Planner>;
  unmarkYearCompleted(plannerId: number): Promise<Planner>;
}

export interface ICompletedCoursesService {
  getCompletedCourses(): Promise<CompletedCourse[]>;
  addCompletedCourse(courseId: number, gradeCompleted: GradeCompleted, courseDetails?: PlannerCourseDetails): Promise<CompletedCourse>;
  addCompletedCourse(item: { summerCourseId: number; gradeCompleted: GradeCompleted; summerCourse: SummerCourse }): Promise<CompletedCourse>;
  addCompletedCourse(selection: CompletedCourseInput): Promise<CompletedCourse>;
  updateCompletedCourse(id: number, updates: { gradeCompleted?: GradeCompleted }): Promise<CompletedCourse>;
  removeCompletedCourse(id: number): Promise<void>;
}

export interface IAnalysisService {
  getAnalysis(data: StudentPlanningData): Promise<PlannerAnalysis>;
}

export interface IResolutionsService {
  getResolutions(): Promise<RequirementResolution[]>;
  createResolution(data: { type: string; courseId?: number; metadata?: Record<string, unknown> }): Promise<RequirementResolution>;
  deleteResolution(id: number): Promise<void>;
}

export interface ISavedCoursesService {
  getSavedCourseIds(): Promise<number[]>;
  saveCourse(courseId: number): Promise<void>;
  removeSavedCourse(courseId: number): Promise<void>;
}

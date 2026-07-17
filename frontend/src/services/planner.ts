import type { IPlannerService } from "./types";
import {
  getPlanners as authGetPlanners,
  getPlanner as authGetPlanner,
  getPlannerOptions as authGetPlannerOptions,
  searchPlannerCourses as authSearchPlannerCourses,
  addPlannedCourse as authAddPlannedCourse,
  removePlannedCourse as authRemovePlannedCourse,
  movePlannedCourse as authMovePlannedCourse,
  type Planner,
  type PlannedCourse,
  type PlannerCourseDetails,
} from "@/lib/planner";

export const authPlannerService: IPlannerService = {
  seedCourseCatalog: () => {},
  getPlanners: () => authGetPlanners(),
  getPlanner: (year) => authGetPlanner(year),
  getPlannerOptions: (grade) => authGetPlannerOptions(grade),
  searchPlannerCourses: (query) => authSearchPlannerCourses(query),
  addPlannedCourse: (plannerId, courseIdOrItem, semester?, slot?) =>
    authAddPlannedCourse(plannerId as any, courseIdOrItem as any, semester as any, slot as any),
  removePlannedCourse: (id) => authRemovePlannedCourse(id),
  movePlannedCourse: (id, semester, slot) => authMovePlannedCourse(id, semester, slot),
};

function buildDefaultPlanners(): Planner[] {
  return [9, 10, 11, 12].map((year, i) => ({
    id: i + 1,
    schoolYear: year,
    label: `${year}`,
    plannedCourses: [],
  }));
}

function clonePlanner(p: Planner): Planner {
  return { ...p, plannedCourses: p.plannedCourses.map((c) => ({ ...c })) };
}

export function createGuestPlannerService(): IPlannerService {
  let nextCourseEntryId = 1;
  const planners: Planner[] = buildDefaultPlanners();
  const catalog = new Map<number, PlannerCourseDetails>();

  function save() {
    window.dispatchEvent(new Event("planner:changed"));
  }

  return {
    seedCourseCatalog(courses: PlannerCourseDetails[]) {
      catalog.clear();
      for (const course of courses) {
        catalog.set(course.id, course);
      }
    },

    async getPlanners() {
      return planners.map(clonePlanner);
    },

    async getPlanner(year: number) {
      const planner = planners.find((p) => p.schoolYear === year);
      if (!planner) throw new Error(`Planner not found for year ${year}`);
      return clonePlanner(planner);
    },

    async getPlannerOptions(grade: number) {
      return [];
    },

    async searchPlannerCourses(query: string): Promise<PlannerCourseDetails[]> {
      if (catalog.size === 0) return [];
      const q = query.toLowerCase();
      return Array.from(catalog.values()).filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.courseCode && c.courseCode.toLowerCase().includes(q))
      );
    },

    async addPlannedCourse(plannerId: number, courseIdOrItem: any, semester?: number, slot?: number) {
      const planner = planners.find((p) => p.id === plannerId);
      if (!planner) throw new Error("Planner not found");

      const id = nextCourseEntryId++;

      let entry: PlannedCourse;

      if (typeof courseIdOrItem === "number") {
        const courseDetails = catalog.get(courseIdOrItem);
        if (!courseDetails) throw new Error(`Course #${courseIdOrItem} not found in catalog. Call seedCourseCatalog first.`);

        entry = {
          id,
          plannerId,
          courseId: courseIdOrItem,
          plannerOptionId: null,
          semester: semester!,
          slot: slot!,
          slotSpan: 1,
          course: { ...courseDetails },
        };
      } else {
        entry = {
          id,
          plannerId,
          courseId: null,
          plannerOptionId: courseIdOrItem.plannerOptionId,
          semester: courseIdOrItem.semester,
          slot: courseIdOrItem.slot,
          slotSpan: 1,
          course: {
            id: -(courseIdOrItem.plannerOptionId),
            title: `Option ${courseIdOrItem.plannerOptionId}`,
            normalizedTitle: null,
            duration: 1,
            slotsPerSemester: 1,
            creditType: null,
            credits: null,
            division: null,
            department: null,
            description: null,
            fulfillsRequirements: [],
            prerequisites: [],
            courseCode: null,
            gradeMin: null,
            gradeMax: null,
            isNonAcademic: true,
            isMarchingBand: false,
          },
        };
      }

      planner.plannedCourses.push(entry);
      save();
      return clonePlanner(planner);
    },

    async removePlannedCourse(plannedCourseId: number) {
      for (const planner of planners) {
        const idx = planner.plannedCourses.findIndex((pc) => pc.id === plannedCourseId);
        if (idx !== -1) {
          planner.plannedCourses.splice(idx, 1);
          break;
        }
      }
      save();
    },

    async movePlannedCourse(plannedCourseId: number, semester: number, slot: number) {
      for (const planner of planners) {
        const entry = planner.plannedCourses.find((pc) => pc.id === plannedCourseId);
        if (entry) {
          entry.semester = semester;
          entry.slot = slot;
          save();
          return clonePlanner(planner);
        }
      }
      throw new Error("Planned course not found");
    },
  };
}

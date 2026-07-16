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
  getPlanners: () => authGetPlanners(),
  getPlanner: (year) => authGetPlanner(year),
  getPlannerOptions: (grade) => authGetPlannerOptions(grade),
  searchPlannerCourses: (query) => authSearchPlannerCourses(query),
  addPlannedCourse: (plannerId, courseIdOrItem, semester?, slot?) =>
    authAddPlannedCourse(plannerId as any, courseIdOrItem as any, semester as any, slot as any),
  removePlannedCourse: (id) => authRemovePlannedCourse(id),
  movePlannedCourse: (id, semester, slot) => authMovePlannedCourse(id, semester, slot),
};

let plannerIdCounter = 0;
let courseEntryIdCounter = 0;

function buildDefaultPlanners(): Planner[] {
  plannerIdCounter = 0;
  courseEntryIdCounter = 0;
  return [9, 10, 11, 12].map((year) => {
    plannerIdCounter++;
    return { id: plannerIdCounter, schoolYear: year, label: `${year}`, plannedCourses: [] };
  });
}

function clonePlanner(p: Planner): Planner {
  return { ...p, plannedCourses: p.plannedCourses.map((c) => ({ ...c })) };
}

export function createGuestPlannerService(): IPlannerService {
  const planners: Planner[] = buildDefaultPlanners();

  function save() {
    window.dispatchEvent(new Event("planner:changed"));
  }

  return {
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
      return [];
    },

    async addPlannedCourse(plannerId: number, courseIdOrItem: any, semester?: number, slot?: number) {
      const planner = planners.find((p) => p.id === plannerId);
      if (!planner) throw new Error("Planner not found");

      courseEntryIdCounter++;
      const id = courseEntryIdCounter;

      let courseId: number | null;
      let plannerOptionId: number | null;
      let actualSemester: number;
      let actualSlot: number;

      if (typeof courseIdOrItem === "number") {
        courseId = courseIdOrItem;
        plannerOptionId = null;
        actualSemester = semester!;
        actualSlot = slot!;
      } else {
        courseId = null;
        plannerOptionId = courseIdOrItem.plannerOptionId;
        actualSemester = courseIdOrItem.semester;
        actualSlot = courseIdOrItem.slot;
      }

      const entry: PlannedCourse = {
        id,
        plannerId,
        courseId,
        plannerOptionId,
        semester: actualSemester,
        slot: actualSlot,
        slotSpan: 1,
        course: {
          id: courseId ?? -(plannerOptionId ?? 0),
          title: courseId ? `Course ${courseId}` : `Option ${plannerOptionId}`,
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
          isNonAcademic: false,
          isMarchingBand: false,
        },
      };

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

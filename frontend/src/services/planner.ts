import type { IPlannerService } from "./types";
import {
  getPlanners as authGetPlanners,
  getPlanner as authGetPlanner,
  getPlannerOptions as authGetPlannerOptions,
  searchPlannerCourses as authSearchPlannerCourses,
  addPlannedCourse as authAddPlannedCourse,
  removePlannedCourse as authRemovePlannedCourse,
  movePlannedCourse as authMovePlannedCourse,
  markPlannerYearCompleted as authMarkPlannerYearCompleted,
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
  markYearCompleted: (plannerId) => authMarkPlannerYearCompleted(plannerId),
};

function buildDefaultPlanners(): Planner[] {
  return [9, 10, 11, 12].map((year, i) => ({
    id: i + 1,
    schoolYear: year,
    label: `${year}`,
    completedAt: null,
    plannedCourses: [],
  }));
}

function clonePlanner(p: Planner): Planner {
  return { ...p, plannedCourses: p.plannedCourses.map((c) => ({ ...c })) };
}

function occupied(planner: Planner, semester: number, slot: number, excludingCourseId?: number | null): boolean {
  return planner.plannedCourses.some(
    (pc) =>
      pc.semester === semester &&
      pc.slot === slot &&
      (excludingCourseId == null || pc.courseId !== excludingCourseId)
  );
}

function findAdjacentPair(planner: Planner, excludingCourseId?: number | null): number | null {
  for (let slot = 1; slot <= 6; slot++) {
    if (
      !occupied(planner, 1, slot, excludingCourseId) &&
      !occupied(planner, 1, slot + 1, excludingCourseId) &&
      !occupied(planner, 2, slot, excludingCourseId) &&
      !occupied(planner, 2, slot + 1, excludingCourseId)
    ) {
      return slot;
    }
  }
  return null;
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

      let entry: PlannedCourse;

      if (typeof courseIdOrItem === "number") {
        const courseDetails = catalog.get(courseIdOrItem);
        if (!courseDetails) throw new Error(`Course #${courseIdOrItem} not found in catalog. Call seedCourseCatalog first.`);

        if (courseDetails.duration === 2 && courseDetails.slotsPerSemester > 1) {
          const startSlot = findAdjacentPair(planner);
          if (startSlot == null) {
            throw new Error("American Studies requires two adjacent class periods in both semesters.");
          }
          for (const sem of [1, 2]) {
            for (let offset = 0; offset < courseDetails.slotsPerSemester; offset++) {
              planner.plannedCourses.push({
                id: nextCourseEntryId++,
                plannerId,
                courseId: courseIdOrItem,
                plannerOptionId: null,
                semester: sem,
                slot: startSlot + offset,
                slotSpan: 1,
                course: { ...courseDetails },
              });
            }
          }
          save();
          return clonePlanner(planner);
        }

        entry = {
          id: nextCourseEntryId++,
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
          id: nextCourseEntryId++,
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
            attributes: [],
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
          const planned = planner.plannedCourses[idx];
          if (planned.courseId != null) {
            planner.plannedCourses = planner.plannedCourses.filter((pc) => pc.courseId !== planned.courseId);
          } else {
            planner.plannedCourses.splice(idx, 1);
          }
          break;
        }
      }
      save();
    },

    async movePlannedCourse(plannedCourseId: number, semester: number, slot: number) {
      for (const planner of planners) {
        const entry = planner.plannedCourses.find((pc) => pc.id === plannedCourseId);
        if (entry) {
          if (entry.course.duration === 2 && entry.course.slotsPerSemester > 1 && entry.courseId != null) {
            const startSlot = slot;
            if (
              startSlot > 6 ||
              occupied(planner, 1, startSlot, entry.courseId) ||
              occupied(planner, 1, startSlot + 1, entry.courseId) ||
              occupied(planner, 2, startSlot, entry.courseId) ||
              occupied(planner, 2, startSlot + 1, entry.courseId)
            ) {
              throw new Error("American Studies requires two adjacent class periods in both semesters.");
            }
            const currentStart = Math.min(
              ...planner.plannedCourses.filter((pc) => pc.courseId === entry.courseId).map((pc) => pc.slot)
            );
            for (const pc of planner.plannedCourses.filter((pc) => pc.courseId === entry.courseId)) {
              pc.slot = startSlot + (pc.slot - currentStart);
            }
            save();
            return clonePlanner(planner);
          }
          entry.semester = semester;
          entry.slot = slot;
          save();
          return clonePlanner(planner);
        }
      }
      throw new Error("Planned course not found");
    },

    async markYearCompleted(plannerId: number) {
      const planner = planners.find((p) => p.id === plannerId);
      if (!planner) throw new Error("Planner not found");
      if (planner.plannedCourses.length === 0) {
        throw new Error("Add planned courses before marking this year completed.");
      }
      if (planner.completedAt != null) {
        throw new Error("This year has already been marked as completed.");
      }
      planner.completedAt = new Date().toISOString();
      save();
      return clonePlanner(planner);
    },
  };
}

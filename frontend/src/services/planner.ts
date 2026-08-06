import type { IPlannerService } from "./types";
 import {
   getPlanners as authGetPlanners,
   getPlanner as authGetPlanner,
   getPlannerOptions as authGetPlannerOptions,
   searchPlannerCourses as authSearchPlannerCourses,
   addPlannedCourse as authAddPlannedCourse,
   removePlannedCourse as authRemovePlannedCourse,
   movePlannedCourse as authMovePlannedCourse,
   setPlannedCourseEarlyBird as authSetPlannedCourseEarlyBird,
   markPlannerYearCompleted as authMarkPlannerYearCompleted,
   unmarkPlannerYearCompleted as authUnmarkPlannerYearCompleted,
type Planner,
    type PlannedCourse,
    type PlannerCourseDetails,
  } from "@/lib/planner";
 import { isRegularSemester } from "@/lib/plannerSemesters";

export const authPlannerService: IPlannerService = {
  seedCourseCatalog: () => {},
  getPlanners: () => authGetPlanners(),
  getPlanner: (year) => authGetPlanner(year),
  getPlannerOptions: (grade) => authGetPlannerOptions(grade),
  searchPlannerCourses: (query) => authSearchPlannerCourses(query),
  addPlannedCourse: (plannerId, courseIdOrItem, semester?, slot?, isEarlyBird?) =>
    authAddPlannedCourse(plannerId as any, courseIdOrItem as any, semester as any, slot as any, isEarlyBird as any),
  removePlannedCourse: (id) => authRemovePlannedCourse(id),
  movePlannedCourse: (id, semester, slot) => authMovePlannedCourse(id, semester, slot),
  updateEarlyBird: (id, isEarlyBird) => authSetPlannedCourseEarlyBird(id, isEarlyBird),
  markYearCompleted: (plannerId) => authMarkPlannerYearCompleted(plannerId),
  unmarkYearCompleted: (plannerId) => authUnmarkPlannerYearCompleted(plannerId),
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
      pc.slot <= slot &&
      slot < pc.slot + (pc.slotSpan ?? 1) &&
      (excludingCourseId == null || pc.courseId !== excludingCourseId)
  );
}

function hasConsecutiveFreeSlots(planner: Planner, semester: number, startSlot: number, count: number, excludingCourseId?: number | null): boolean {
  if (startSlot + count - 1 > 7) return false;
  for (let i = 0; i < count; i++) {
    if (occupied(planner, semester, startSlot + i, excludingCourseId)) return false;
  }
  return true;
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

    async addPlannedCourse(plannerId: number, courseIdOrItem: any, semester?: number, slot?: number, isEarlyBird?: boolean) {
      const planner = planners.find((p) => p.id === plannerId);
      if (!planner) throw new Error("Planner not found");

      if (typeof courseIdOrItem === "number") {
        const courseDetails = catalog.get(courseIdOrItem);
        if (!courseDetails) throw new Error(`Course #${courseIdOrItem} not found in catalog. Call seedCourseCatalog first.`);

        const earlyBird = isEarlyBird === true;
        if (earlyBird && !courseDetails.supportsEarlyBird) {
          throw new Error("Early Bird is only available for 1.5-period science courses.");
        }
        if (earlyBird) {
          const ebSemesters = courseDetails.duration === 2 ? [1, 2] : [semester];
          const hasOtherEb = planner.plannedCourses.some(
            (pc) => pc.isEarlyBird && pc.courseId !== courseIdOrItem && ebSemesters.includes(pc.semester)
          );
          if (hasOtherEb) {
            throw new Error("You may only take one Early Bird course each semester.");
          }
        }

        if (semester != null && semester > 2) {
          const entry: PlannedCourse = {
            id: nextCourseEntryId++,
            plannerId,
            courseId: courseIdOrItem,
            plannerOptionId: null,
            semester: semester,
            slot: slot ?? 1,
            slotSpan: courseDetails.slotsPerSemester ?? 1,
            course: { ...courseDetails },
            isEarlyBird: earlyBird,
          };
          planner.plannedCourses.push(entry);
          save();
          return clonePlanner(planner);
        }

        if (courseDetails.duration === 2 && courseDetails.slotsPerSemester > 1) {
          const slotSpan = courseDetails.slotsPerSemester;
          const maxSlot = 7;

          const canPlaceAt = (s: number): boolean => {
            if (s + slotSpan - 1 > maxSlot) return false;
            for (const sem of [1, 2]) {
              for (let i = 0; i < slotSpan; i++) {
                if (occupied(planner, sem, s + i)) return false;
              }
            }
            return true;
          };

          const tryShiftAt = (s: number): boolean => {
            if (s + slotSpan - 1 > maxSlot) return false;
            const allMutations: Array<{ pc: typeof planner.plannedCourses[0]; target: number }> = [];
            for (const sem of [1, 2]) {
              const semCourses = planner.plannedCourses
                .filter((pc) => pc.semester === sem)
                .sort((a, b) => b.slot - a.slot);
              const usedTargets = new Set<number>();
              for (const pc of semCourses) {
                if (pc.slot < s) continue;
                if (pc.course.duration === 2 || (pc.slotSpan ?? 1) > 1) return false;
                let target = pc.slot + slotSpan;
                while (target <= maxSlot && usedTargets.has(target)) { target++; }
                if (target > maxSlot) return false;
                usedTargets.add(target);
                allMutations.push({ pc, target });
              }
            }
            for (const m of allMutations) {
              m.pc.slot = m.target;
            }
            return true;
          };

          let startSlot: number | null = null;
          if (slot != null) {
            if (canPlaceAt(slot)) {
              startSlot = slot;
            } else if (tryShiftAt(slot)) {
              startSlot = slot;
            }
          }
          if (startSlot == null) {
            startSlot = findAdjacentPair(planner);
          }
          if (startSlot == null) {
            throw new Error("American Studies requires two consecutive periods. There is not enough space in this semester.");
          }
          for (const sem of [1, 2]) {
            planner.plannedCourses.push({
              id: nextCourseEntryId++,
              plannerId,
              courseId: courseIdOrItem,
              plannerOptionId: null,
              semester: sem,
              slot: startSlot,
              slotSpan,
              course: { ...courseDetails },
              isEarlyBird: earlyBird,
            });
          }
          save();
          return clonePlanner(planner);
        }

        if (courseDetails.duration === 2) {
          if (semester != null && semester > 2) {
            throw new Error("Full-year courses cannot be added to Summer School or Online Courses.");
          }
          if (occupied(planner, 1, slot!, null) || occupied(planner, 2, slot!, null)) {
            throw new Error("This slot is already occupied in one or both semesters.");
          }
          for (const sem of [1, 2]) {
            planner.plannedCourses.push({
              id: nextCourseEntryId++,
              plannerId,
              courseId: courseIdOrItem,
              plannerOptionId: null,
              semester: sem,
              slot: slot!,
              slotSpan: 1,
              course: { ...courseDetails },
              isEarlyBird: earlyBird,
            });
          }
          save();
          return clonePlanner(planner);
        }

        if (isRegularSemester(semester!) && occupied(planner, semester!, slot!, null)) {
          throw new Error("This slot is already occupied.");
        }

        const entry: PlannedCourse = {
          id: nextCourseEntryId++,
          plannerId,
          courseId: courseIdOrItem,
          plannerOptionId: null,
          semester: semester!,
          slot: slot ?? 1,
          slotSpan: 1,
          course: { ...courseDetails },
          isEarlyBird: earlyBird,
        };
        planner.plannedCourses.push(entry);
        save();
        return clonePlanner(planner);
      }

      if (isRegularSemester(courseIdOrItem.semester) && occupied(planner, courseIdOrItem.semester, courseIdOrItem.slot, null)) {
        throw new Error("This slot is already occupied.");
      }

      const entry: PlannedCourse = {
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
          courseCodeS1: null,
          courseCodeS2: null,
          gradeMin: null,
          gradeMax: null,
          isNonAcademic: true,
          isMarchingBand: false,
          attributes: [],
          supportsEarlyBird: false,
          isRepeatable: false,
          isOnline: false,
        },
        isEarlyBird: false,
      };
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
          if (semester > 2) {
            entry.semester = semester;
            entry.slot = slot ?? 1;
            save();
            return clonePlanner(planner);
          }
          if (entry.course.duration === 2 && entry.course.slotsPerSemester > 1 && entry.courseId != null) {
            const blockWidth = entry.course.slotsPerSemester;
            const startSlot = slot;
            if (
              startSlot > 7 - blockWidth + 1 ||
              !hasConsecutiveFreeSlots(planner, 1, startSlot, blockWidth, entry.courseId) ||
              !hasConsecutiveFreeSlots(planner, 2, startSlot, blockWidth, entry.courseId)
            ) {
              throw new Error("American Studies requires two adjacent class periods in both semesters.");
            }
            for (const pc of planner.plannedCourses.filter((pc) => pc.courseId === entry.courseId)) {
              pc.slot = startSlot;
            }
            save();
            return clonePlanner(planner);
          }
          if (entry.courseId != null) {
            const targetSemesters = entry.course.duration === 2 ? [1, 2] : [semester];
            for (const sem of targetSemesters) {
              if (occupied(planner, sem, slot!, entry.courseId)) {
                throw new Error("This slot is already occupied.");
              }
            }
          } else {
            if (occupied(planner, semester, slot, null)) {
              throw new Error("This slot is already occupied.");
            }
          }
          entry.semester = semester;
          entry.slot = slot;
          save();
          return clonePlanner(planner);
        }
      }
      throw new Error("Planned course not found");
    },

    async updateEarlyBird(plannedCourseId: number, isEarlyBird: boolean) {
      for (const planner of planners) {
        const entry = planner.plannedCourses.find((pc) => pc.id === plannedCourseId);
        if (entry) {
          if (!entry.course.supportsEarlyBird) {
            throw new Error("Early Bird is only available for 1.5-period science courses.");
          }
          if (isEarlyBird && entry.courseId != null) {
            const targetSemesters = entry.course.duration === 2 ? [1, 2] : [entry.semester];
            const conflict = planner.plannedCourses.some(
              (pc) =>
                pc.isEarlyBird &&
                pc.courseId !== entry.courseId &&
                targetSemesters.includes(pc.semester)
            );
            if (conflict) {
              throw new Error("You may only take one Early Bird course each semester.");
            }
          }
          if (entry.courseId != null) {
            for (const pc of planner.plannedCourses) {
              if (pc.courseId === entry.courseId) pc.isEarlyBird = isEarlyBird;
            }
          } else {
            entry.isEarlyBird = isEarlyBird;
          }
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

    async unmarkYearCompleted(plannerId: number) {
      const planner = planners.find((p) => p.id === plannerId);
      if (!planner) throw new Error("Planner not found");
      if (planner.completedAt == null) {
        throw new Error("This year is not marked as completed.");
      }
      planner.completedAt = null;
      save();
      return clonePlanner(planner);
    },
  };
}

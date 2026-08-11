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
 import type { SummerCourse } from "@/lib/summerCourse";
 import type { CompletedCourse, GradeCompleted } from "@/lib/completedCourses";
 import type { GuestDataStore } from "./guestStore";

 const GUEST_ACADEMIC_GRADE_BY_YEAR: Record<number, GradeCompleted> = {
  9: "Freshman (9)",
  10: "Sophomore (10)",
  11: "Junior (11)",
  12: "Senior (12)",
 };

export const authPlannerService: IPlannerService = {
  seedCourseCatalog: () => {},
  getPlanners: () => authGetPlanners(),
  getPlanner: (year) => authGetPlanner(year),
  getPlannerOptions: (grade) => authGetPlannerOptions(grade),
  searchPlannerCourses: (query) => authSearchPlannerCourses(query),
  addPlannedCourse: (plannerId, courseIdOrItem, semester?, slot?, isEarlyBird?) =>
    authAddPlannedCourse(plannerId as any, courseIdOrItem as any, semester as any, slot as any, isEarlyBird as any),
  addSummerCourse: (plannerId, summerCourse, semester) =>
    authAddPlannedCourse(plannerId as any, { summerCourseId: summerCourse.id, semester: semester } as any),
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

// Following-year mapping for Summer School completions (a summer course planned
// in year N's section is taken the summer before grade N), mirroring the backend.
const GUEST_SUMMER_GRADE_BY_YEAR: Record<number, GradeCompleted> = {
  9: "Freshman (9)",
  10: "Sophomore (10)",
  11: "Junior (11)",
  12: "Senior (12)",
};

function buildSummerPlannedCourse(
  plannerId: number,
  summerCourse: SummerCourse,
  semester: number,
  id: number
): PlannedCourse {
  const matched = summerCourse.regularCourse;
  const isFullSummer = summerCourse.duration === "full_summer";
  return {
    id,
    plannerId,
    courseId: null,
    summerCourseId: summerCourse.id,
    plannerOptionId: null,
    semester,
    slot: 1,
    slotSpan: 1,
    course: {
      id: -(10000 + summerCourse.id),
      title: summerCourse.title,
      normalizedTitle: null,
      duration: isFullSummer ? 2 : 1,
      slotsPerSemester: 1,
      creditType: null,
      credits: summerCourse.credits ?? null,
      division: matched?.division ?? null,
      department: matched?.department ?? null,
      description: null,
      fulfillsRequirements: summerCourse.fulfillsRequirements ?? [],
      prerequisites: summerCourse.prerequisites ?? [],
      courseCode: summerCourse.courseCode ?? null,
      courseCodeS1: null,
      courseCodeS2: null,
      gradeMin: null,
      gradeMax: null,
      isNonAcademic: false,
      isMarchingBand: false,
      attributes: [],
      supportsEarlyBird: false,
      isRepeatable: matched?.isRepeatable ?? false,
      isOnline: false,
    },
    summerCourse,
    isEarlyBird: false,
  };
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

// Mirrors the backend retake rule: repeatable one-semester PE courses may be
// taken across semesters, so a summer seat + regular seat is a legit retake.
function isRepeatableOneSemesterPe(course: PlannerCourseDetails | null | undefined): boolean {
  return (
    course?.isRepeatable === true &&
    course.duration === 1 &&
    course.department === "Physical Education"
  );
}

// A Summer School course linked to a regular catalog course (regularCourse) is
// the same course attempt as its regular equivalent. True when that regular
// equivalent is already planned or completed (unless a repeatable one-sem PE).
function summerEquivalentIsDuplicate(
  summerCourse: SummerCourse,
  planners: Planner[],
  completedCourses: CompletedCourse[]
): boolean {
  const regular = summerCourse.regularCourse;
  if (!regular || isRepeatableOneSemesterPe(regular)) return false;
  const planned = planners.some((p) =>
    p.plannedCourses.some((pc) => pc.courseId === regular.id)
  );
  if (planned) return true;
  return completedCourses.some((cc) => cc.courseId === regular.id);
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

export function createGuestPlannerService(store?: GuestDataStore): IPlannerService {
  let nextCourseEntryId = 1;
  const inMemoryStore = store ?? { planners: [] as Planner[], completedCourses: [] as CompletedCourse[], completedIdSeq: 0 };
  if (!store || inMemoryStore.planners.length === 0) {
    inMemoryStore.planners = buildDefaultPlanners();
  }
  const planners = inMemoryStore.planners;
  const completedCourses = inMemoryStore.completedCourses;
  // Track completed-course ids created by marking a year complete, so unmaking
  // the year removes exactly those (and never a user-entered completed course).
  const completedCourseIdsByPlanner = new WeakMap<Planner, number[]>();
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

        // The Summer School equivalent of a regular course is the same course
        // attempt. Block adding the regular course when its summer equivalent
        // is already planned (unless repeatable one-semester PE).
        if (!isRepeatableOneSemesterPe(courseDetails)) {
          const summerEquivalentPlanned = planners.some((p) =>
            p.plannedCourses.some((pc) => pc.summerCourse?.regularCourse?.id === courseIdOrItem)
          );
          if (summerEquivalentPlanned) {
            throw new Error("The Summer School equivalent of this course is already planned in your schedule.");
          }
        }

        if (semester != null && semester > 2) {
          const sectionName = semester <= 4 ? "Summer School" : "Online Courses";
          const targetSemesters = courseDetails.duration === 2 ? (semester <= 4 ? [3, 4] : [5, 6]) : [semester];
          const occupiedSemester = targetSemesters.find((sem) =>
            planner.plannedCourses.some((pc) => pc.semester === sem && (pc.courseId != null || pc.plannerOptionId != null))
          );
          if (occupiedSemester != null) {
            const occSubIndex = occupiedSemester % 2 === 0 ? 2 : 1;
            throw new Error(
              `${sectionName} Semester ${occSubIndex} already has a course. Only one course is allowed per semester. Remove it before adding another.`
            );
          }
          const entry: PlannedCourse = {
            id: nextCourseEntryId++,
            plannerId,
            courseId: courseIdOrItem,
            plannerOptionId: null,
            semester: semester,
            slot: 1,
            slotSpan: 1,
            course: { ...courseDetails },
            isEarlyBird: earlyBird,
          };
          if (courseDetails.duration === 2) {
            const block = targetSemesters.filter((s) => s !== semester);
            const secondSession: PlannedCourse = { ...entry, id: nextCourseEntryId++ };
            if (block.length > 0) secondSession.semester = block[0];
            planner.plannedCourses.push(entry, secondSession);
          } else {
            planner.plannedCourses.push(entry);
          }
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

    async addSummerCourse(plannerId: number, summerCourse: SummerCourse, semester: number) {
      const planner = planners.find((p) => p.id === plannerId);
      if (!planner) throw new Error("Planner not found");
      if (semester < 3 || semester > 4) {
        throw new Error("Summer courses can only be planned in a Summer School semester.");
      }

      const gradeLevels = summerCourse.gradeLevels ?? [];
      if (gradeLevels.length > 0 && !gradeLevels.includes(planner.schoolYear)) {
        throw new Error(
          `${summerCourse.title} is open to grade${gradeLevels.length === 1 ? "" : "s"} ${gradeLevels.join("-")} and cannot be planned for the summer before grade ${planner.schoolYear}.`
        );
      }

      const isFullSummer = summerCourse.duration === "full_summer";
      const targetSemesters = isFullSummer ? [3, 4] : [semester];
      const sessions = (summerCourse.sessions ?? []).map((value) => value.trim().toLowerCase());
      const expectedSession = semester === 4 ? "session 2" : "session 1";
      if (
        sessions.length > 0 &&
        (isFullSummer
          ? !(sessions.includes("session 1") && sessions.includes("session 2"))
          : !sessions.includes(expectedSession))
      ) {
        throw new Error(
          isFullSummer
            ? `${summerCourse.title} is not offered for the full summer.`
            : `${summerCourse.title} is not offered in ${expectedSession.replace(/^\w/, (c) => c.toUpperCase())}.`
        );
      }
      const occupiedSemester = targetSemesters.find((sem) =>
        planner.plannedCourses.some((pc) => pc.semester === sem && pc.id != null)
      );
      if (occupiedSemester != null) {
        const subIndex = occupiedSemester === 4 ? 2 : 1;
        throw new Error(
          `Summer School Semester ${subIndex} already has a course. Only one course is allowed per semester. Remove it before adding another.`
        );
      }

      const existingDuplicate = planner.plannedCourses.find((pc) => pc.summerCourseId === summerCourse.id);
      if (existingDuplicate) {
        throw new Error("This summer course is already planned in your schedule");
      }

      // The Summer School course is the same course attempt as its matched
      // regular equivalent. Block when the regular equivalent is already
      // planned or completed (unless repeatable one-semester PE).
      if (summerEquivalentIsDuplicate(summerCourse, planners, completedCourses)) {
        const regular = summerCourse.regularCourse;
        const plannedRegular = planners.some((p) =>
          p.plannedCourses.some((pc) => pc.courseId === regular!.id)
        );
        throw new Error(
          plannedRegular
            ? "This course is already planned in your schedule (regular equivalent)."
            : "You have already completed this course (regular equivalent)."
        );
      }

      const entry = buildSummerPlannedCourse(planner.id, summerCourse, semester, nextCourseEntryId++);
      planner.plannedCourses.push(entry);
      if (isFullSummer) {
        const second = buildSummerPlannedCourse(planner.id, summerCourse, semester === 3 ? 4 : 3, nextCourseEntryId++);
        planner.plannedCourses.push(second);
      }
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
          } else if (planned.summerCourseId != null) {
            planner.plannedCourses = planner.plannedCourses.filter((pc) => pc.summerCourseId !== planned.summerCourseId);
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
            const sectionName = semester <= 4 ? "Summer School" : "Online Courses";
            const targetSemesters = entry.course.duration === 2 ? (semester <= 4 ? [3, 4] : [5, 6]) : [semester];
            const occupiedSemester = targetSemesters.find((sem) =>
              planner.plannedCourses.some(
                (pc) => pc.semester === sem && pc.id !== plannedCourseId && (pc.courseId != null || pc.plannerOptionId != null)
              )
            );
            if (occupiedSemester != null) {
              const occSubIndex = occupiedSemester % 2 === 0 ? 2 : 1;
              throw new Error(
                `${sectionName} Semester ${occSubIndex} already has a course. Only one course is allowed per semester.`
              );
            }
            entry.semester = semester;
            entry.slot = 1;
            if (entry.course.duration === 2 && entry.courseId != null) {
              for (const pc of planner.plannedCourses) {
                if (pc.id !== plannedCourseId && pc.courseId === entry.courseId) {
                  pc.semester = targetSemesters.find((s) => s !== semester) ?? semester;
                  pc.slot = 1;
                }
              }
            }
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
      const gradeLabel = GUEST_ACADEMIC_GRADE_BY_YEAR[planner.schoolYear];
      if (!gradeLabel) throw new Error("Planner year cannot be marked completed");

      const createdIds: number[] = [];
      const seen = new Set<number>();
      const seenSummer = new Set<number>();
      for (const planned of planner.plannedCourses) {
        if (planned.courseId == null) {
          if (planned.summerCourseId == null || seenSummer.has(planned.summerCourseId)) continue;
          seenSummer.add(planned.summerCourseId);
          completedCourses.push({
            id: ++inMemoryStore.completedIdSeq,
            userId: -1,
            courseId: null,
            summerCourseId: planned.summerCourseId,
            gradeCompleted: GUEST_SUMMER_GRADE_BY_YEAR[planner.schoolYear] ?? "Summer School",
            credits: planned.course.credits ?? null,
            course: null,
            summerCourse: planned.summerCourse ?? null,
          });
          createdIds.push(inMemoryStore.completedIdSeq);
          continue;
        }
        if (seen.has(planned.courseId)) continue;
        seen.add(planned.courseId);
        completedCourses.push({
          id: ++inMemoryStore.completedIdSeq,
          userId: -1,
          courseId: planned.courseId,
          summerCourseId: null,
          gradeCompleted: gradeLabel,
          credits: planned.course.credits ?? null,
          course: { ...planned.course },
          summerCourse: null,
        });
        createdIds.push(inMemoryStore.completedIdSeq);
      }
      completedCourseIdsByPlanner.set(planner, createdIds);

      planner.completedAt = new Date().toISOString();
      save();
      window.dispatchEvent(new Event("completed-courses:changed"));
      return clonePlanner(planner);
    },

    async unmarkYearCompleted(plannerId: number) {
      const planner = planners.find((p) => p.id === plannerId);
      if (!planner) throw new Error("Planner not found");
      if (planner.completedAt == null) {
        throw new Error("This year is not marked as completed.");
      }
      const createdIds = new Set(completedCourseIdsByPlanner.get(planner) ?? []);
      const retained = completedCourses.filter((cc) => !createdIds.has(cc.id));
      completedCourses.length = 0;
      completedCourses.push(...retained);
      completedCourseIdsByPlanner.delete(planner);

      planner.completedAt = null;
      save();
      window.dispatchEvent(new Event("completed-courses:changed"));
      return clonePlanner(planner);
    },
  };
}

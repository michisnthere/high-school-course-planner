import type { ICompletedCoursesService } from "./types";
import type { PlannerCourseDetails } from "@/lib/planner";
import type { SummerCourse } from "@/lib/summerCourse";
import type { GuestDataStore } from "./guestStore";
import { isGradeValidForContext, isSummerGrade } from "@/lib/completedCoursePeriods";
import {
  getCompletedCourses as authGetCompletedCourses,
  addCompletedCourse as authAddCompletedCourse,
  updateCompletedCourse as authUpdateCompletedCourse,
  removeCompletedCourse as authRemoveCompletedCourse,
  type CompletedCourse,
  type CompletedCourseInput,
  type GradeCompleted,
} from "@/lib/completedCourses";

export const authCompletedCoursesService: ICompletedCoursesService = {
  getCompletedCourses: () => authGetCompletedCourses(),
  addCompletedCourse: (
    courseIdOrItem: number | { summerCourseId: number; gradeCompleted: GradeCompleted; summerCourse: SummerCourse } | CompletedCourseInput,
    gradeCompleted?: GradeCompleted,
    _courseDetails?: PlannerCourseDetails
  ) => {
    if (typeof courseIdOrItem === "number") {
      return authAddCompletedCourse(courseIdOrItem, gradeCompleted as GradeCompleted);
    }
    if ("summerCourseId" in courseIdOrItem && courseIdOrItem.summerCourseId != null) {
      return authAddCompletedCourse(null, courseIdOrItem.gradeCompleted, undefined, courseIdOrItem.summerCourseId);
    }
    if ("courseId" in courseIdOrItem && courseIdOrItem.courseId != null) {
      return authAddCompletedCourse(courseIdOrItem.courseId, courseIdOrItem.gradeCompleted);
    }
    throw new Error("Invalid completed course selection");
  },
  updateCompletedCourse: (id, updates) => authUpdateCompletedCourse(id, updates),
  removeCompletedCourse: (id) => authRemoveCompletedCourse(id),
};

let completedIdCounter = 0;

// Mirrors the backend retake rule: repeatable one-semester PE courses may be
// retaken across semesters, so a summer seat + regular seat is a legit retake.
function isRepeatableOneSemesterPe(course: PlannerCourseDetails | null | undefined): boolean {
  return (
    course?.isRepeatable === true &&
    course.duration === 1 &&
    course.department === "Physical Education"
  );
}

export function createGuestCompletedCoursesService(store?: GuestDataStore): ICompletedCoursesService {
  const local: CompletedCourse[] = [];
  const courses = store ? store.completedCourses : local;

  function nextId(): number {
    if (store) return ++store.completedIdSeq;
    return ++completedIdCounter;
  }

  function save() {
    window.dispatchEvent(new Event("completed-courses:changed"));
  }

  function addRegularCourse(
    courseId: number,
    gradeCompleted: GradeCompleted,
    courseDetails?: PlannerCourseDetails
  ): CompletedCourse | Promise<CompletedCourse> {
    const effectiveGrade = gradeCompleted as GradeCompleted;
    // A regular course must be recorded in a regular period; Summer-specific
    // periods must never be attached to regular coursework.
    if (isSummerGrade(effectiveGrade)) {
      throw new Error("Regular courses cannot be marked completed in a Summer-specific period.");
    }
    // Mirror the backend duplicate guard: each regular course may only be
    // recorded once per user.
    const alreadyCompleted = courses.some((cc) => cc.courseId === courseId);
    if (alreadyCompleted) {
      throw new Error("Course already marked as completed");
    }
    const details = courseDetails ?? {
      id: courseId,
      title: `Course ${courseId}`,
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
      isNonAcademic: false,
      isMarchingBand: false,
      attributes: [],
      supportsEarlyBird: false,
      isRepeatable: false,
      isOnline: false,
    };
    // The Summer School equivalent of a regular course is the same course
    // attempt. Block recording the regular course as completed when its
    // summer equivalent is already completed or planned (unless repeatable).
    if (!isRepeatableOneSemesterPe(details)) {
      const summerEquivalentCompleted = courses.some(
        (cc) => cc.summerCourse?.regularCourse?.id === courseId
      );
      if (summerEquivalentCompleted) {
        throw new Error("You have already completed the Summer School equivalent of this course.");
      }
      const summerEquivalentPlanned = store?.planners.some((p) =>
        p.plannedCourses.some((pc) => pc.summerCourse?.regularCourse?.id === courseId)
      );
      if (summerEquivalentPlanned) {
        throw new Error("The Summer School equivalent of this course is already planned in your schedule.");
      }
    }
    const entry: CompletedCourse = {
      id: nextId(),
      userId: -1,
      courseId,
      summerCourseId: null,
      gradeCompleted: effectiveGrade,
      credits: details.credits,
      course: { ...details },
      summerCourse: null,
    };
    courses.push(entry);
    save();
    return { ...entry, course: entry.course ? { ...entry.course } : null };
  }

  return {
    async getCompletedCourses() {
      return courses.map((c) => ({ ...c, course: c.course ? { ...c.course } : null }));
    },

    async addCompletedCourse(
      courseIdOrItem: number | { summerCourseId: number; gradeCompleted: GradeCompleted; summerCourse: SummerCourse } | CompletedCourseInput,
      gradeCompleted?: GradeCompleted,
      courseDetails?: PlannerCourseDetails
    ) {
      // Normalize CompletedCourseInput (union type from picker) into the
      // existing number | summer-object dispatch.
      if (typeof courseIdOrItem !== "number" && !("summerCourse" in courseIdOrItem)) {
        const input = courseIdOrItem as CompletedCourseInput;
        if (input.summerCourseId != null) {
          throw new Error("Summer School courses require the full summer course data. Use the Summer School picker.");
        }
        if (input.courseId == null) {
          throw new Error("A courseId or summerCourseId is required.");
        }
        return addRegularCourse(input.courseId, input.gradeCompleted, undefined);
      }

      if (typeof courseIdOrItem !== "number") {
        // A Summer School course must be recorded in a Summer-specific period;
        // regular periods must never be attached to summer coursework.
        if (!isSummerGrade(courseIdOrItem.gradeCompleted)) {
          throw new Error("Summer School courses must be marked completed in a Summer-specific period.");
        }
        const summer = courseIdOrItem.summerCourse;
        // The Summer School course is the same course attempt as its matched
        // regular equivalent. Block when the regular equivalent is already
        // completed or planned (unless repeatable one-semester PE).
        const regular = summer.regularCourse;
        if (regular && !isRepeatableOneSemesterPe(regular)) {
          const completedRegular = courses.some((cc) => cc.courseId === regular.id);
          if (completedRegular) {
            throw new Error("You have already completed this course (regular equivalent).");
          }
          const plannedRegular = store?.planners.some((p) =>
            p.plannedCourses.some((pc) => pc.courseId === regular.id)
          );
          if (plannedRegular) {
            throw new Error("This course is already planned in your schedule (regular equivalent).");
          }
        }
        const entry: CompletedCourse = {
          id: nextId(),
          userId: -1,
          courseId: null,
          summerCourseId: courseIdOrItem.summerCourseId,
          gradeCompleted: courseIdOrItem.gradeCompleted,
          credits: summer.credits ?? null,
          course: null,
          summerCourse: { ...summer },
        };
        courses.push(entry);
        save();
        return { ...entry, course: null };
      }
      return addRegularCourse(courseIdOrItem, gradeCompleted ?? "Middle School", courseDetails);
    },

    async updateCompletedCourse(
      id: number,
      updates: { gradeCompleted?: GradeCompleted }
    ) {
      const entry = courses.find((c) => c.id === id);
      if (!entry) throw new Error("Completed course not found");
      if (updates.gradeCompleted !== undefined) {
        const isSummerContext = entry.summerCourseId != null;
        if (isGradeValidForContext(updates.gradeCompleted, isSummerContext) === false) {
          throw new Error(
            isSummerContext
              ? "Summer School courses must keep a Summer-specific period."
              : "Regular courses cannot be marked completed in a Summer-specific period."
          );
        }
        entry.gradeCompleted = updates.gradeCompleted;
      }
      save();
      return { ...entry, course: entry.course ? { ...entry.course } : null };
    },

    async removeCompletedCourse(id: number) {
      const idx = courses.findIndex((c) => c.id === id);
      if (idx !== -1) {
        courses.splice(idx, 1);
        save();
      }
    },
  };
}

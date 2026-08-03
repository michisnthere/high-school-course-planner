import type { ICompletedCoursesService } from "./types";
import type { PlannerCourseDetails } from "@/lib/planner";
import {
  getCompletedCourses as authGetCompletedCourses,
  addCompletedCourse as authAddCompletedCourse,
  updateCompletedCourse as authUpdateCompletedCourse,
  removeCompletedCourse as authRemoveCompletedCourse,
  type CompletedCourse,
  type GradeCompleted,
} from "@/lib/completedCourses";

export const authCompletedCoursesService: ICompletedCoursesService = {
  getCompletedCourses: () => authGetCompletedCourses(),
  addCompletedCourse: (courseId, gradeCompleted, _courseDetails) =>
    authAddCompletedCourse(courseId, gradeCompleted),
  updateCompletedCourse: (id, updates) => authUpdateCompletedCourse(id, updates),
  removeCompletedCourse: (id) => authRemoveCompletedCourse(id),
};

let completedIdCounter = 0;

export function createGuestCompletedCoursesService(): ICompletedCoursesService {
  const courses: CompletedCourse[] = [];

  function save() {
    window.dispatchEvent(new Event("completed-courses:changed"));
  }

  return {
    async getCompletedCourses() {
      return courses.map((c) => ({ ...c, course: { ...c.course } }));
    },

    async addCompletedCourse(
      courseId: number,
      gradeCompleted: GradeCompleted,
      courseDetails?: PlannerCourseDetails
    ) {
      completedIdCounter++;
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
      };
      const entry: CompletedCourse = {
        id: completedIdCounter,
        userId: -1,
        courseId,
        gradeCompleted,
        credits: details.credits,
        course: { ...details },
      };
      courses.push(entry);
      save();
      return { ...entry, course: { ...entry.course } };
    },

    async updateCompletedCourse(
      id: number,
      updates: { gradeCompleted?: GradeCompleted }
    ) {
      const entry = courses.find((c) => c.id === id);
      if (!entry) throw new Error("Completed course not found");
      if (updates.gradeCompleted !== undefined) entry.gradeCompleted = updates.gradeCompleted;
      save();
      return { ...entry, course: { ...entry.course } };
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

import type { ISavedCoursesService } from "./types";
import {
  getSavedCourseIds as authGetSavedCourseIds,
  saveCourse as authSaveCourse,
  removeSavedCourse as authRemoveSavedCourse,
} from "@/lib/savedCourses";

export const authSavedCoursesService: ISavedCoursesService = {
  getSavedCourseIds: () => authGetSavedCourseIds(),
  saveCourse: (courseId) => authSaveCourse(courseId),
  removeSavedCourse: (courseId) => authRemoveSavedCourse(courseId),
};

export function createGuestSavedCoursesService(): ISavedCoursesService {
  const savedIds: number[] = [];

  return {
    async getSavedCourseIds() {
      return [...savedIds];
    },

    async saveCourse(courseId: number) {
      if (!savedIds.includes(courseId)) {
        savedIds.push(courseId);
      }
    },

    async removeSavedCourse(courseId: number) {
      const idx = savedIds.indexOf(courseId);
      if (idx !== -1) {
        savedIds.splice(idx, 1);
      }
    },
  };
}

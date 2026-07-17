import type { ISavedCoursesService } from "./types";
import {
  getSavedCourseIds as authGetSavedCourseIds,
  saveCourse as authSaveCourse,
  removeSavedCourse as authRemoveSavedCourse,
} from "@/lib/savedCourses";

const GUEST_STORAGE_KEY = "guestSavedCourses";

function loadGuestSavedCourses(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.sessionStorage.getItem(GUEST_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function persistGuestSavedCourses(ids: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // sessionStorage full or unavailable
  }
}

export const authSavedCoursesService: ISavedCoursesService = {
  getSavedCourseIds: () => authGetSavedCourseIds(),
  saveCourse: (courseId) => authSaveCourse(courseId),
  removeSavedCourse: (courseId) => authRemoveSavedCourse(courseId),
};

export function createGuestSavedCoursesService(): ISavedCoursesService {
  const savedIds: number[] = loadGuestSavedCourses();

  return {
    async getSavedCourseIds() {
      return [...savedIds];
    },

    async saveCourse(courseId: number) {
      if (!savedIds.includes(courseId)) {
        savedIds.push(courseId);
        persistGuestSavedCourses(savedIds);
      }
    },

    async removeSavedCourse(courseId: number) {
      const idx = savedIds.indexOf(courseId);
      if (idx !== -1) {
        savedIds.splice(idx, 1);
        persistGuestSavedCourses(savedIds);
      }
    },
  };
}

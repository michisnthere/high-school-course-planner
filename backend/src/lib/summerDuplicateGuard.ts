import type { Course, CourseOption, CourseOffering } from "@prisma/client";
import { deriveCourseDuration } from "./courseCredits.js";
import { prisma } from "./prisma.js";

// ---------------------------------------------------------------------------
// Summer School ⇄ regular-catalog duplicate guard.
//
// A Summer School course linked to a regular catalog course (regularCourseId)
// is the SAME course attempt as its regular equivalent.  Adding the summer
// equivalent when the regular course is already planned or completed (and the
// reverse) must be treated as a duplicate, so the two representations never
// double count credits.  Repeatable one-semester PE courses keep the existing
// retake behavior and are exempt.
//
// This deliberately reuses the existing retake rule (isRepeatable +
// one-semester + Physical Education) instead of introducing a second
// duplicate/retake system.
// ---------------------------------------------------------------------------

type RegularCourseLike = Course & {
  department?: { name?: string | null } | null;
  options?: Array<CourseOption & { offerings?: CourseOffering[] }>;
};

export function isRepeatableOneSemesterPe(course: RegularCourseLike | null | undefined): boolean {
  if (!course) return false;
  return (
    course.isRepeatable === true &&
    deriveCourseDuration(course) === 1 &&
    course.department?.name === "Physical Education"
  );
}

/** True when the user already planned the summer equivalent of a regular course. */
export function findSummerEquivalentPlanned(userId: number, regularCourseId: number) {
  return prisma.plannedCourse.findFirst({
    where: { planner: { userId }, summerCourse: { regularCourseId } },
  });
}

/** True when the user already completed the summer equivalent of a regular course. */
export function findSummerEquivalentCompleted(userId: number, regularCourseId: number) {
  return prisma.completedCourse.findFirst({
    where: { userId, summerCourse: { regularCourseId } },
  });
}

/** True when the user already planned the regular equivalent of a summer course. */
export function findRegularEquivalentPlanned(userId: number, regularCourseId: number) {
  return prisma.plannedCourse.findFirst({
    where: { planner: { userId }, courseId: regularCourseId },
  });
}

/** True when the user already completed the regular equivalent of a summer course. */
export function findRegularEquivalentCompleted(userId: number, regularCourseId: number) {
  return prisma.completedCourse.findFirst({
    where: { userId, courseId: regularCourseId },
  });
}

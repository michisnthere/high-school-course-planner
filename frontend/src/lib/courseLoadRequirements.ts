import type { PlannedCourse } from "./planner";
import { effectiveSlotSpan, getCourseCredits, getPlacementKey, getSemesterCredits, isOnePointFivePeriodScienceCourse } from "./courseCredits";
import { isOutOfSemester } from "./plannerSemesters";

export type SemesterCreditStatus = {
  semester: number;
  earnedCredits: number;
  requiredCredits: number;
  isMet: boolean;
};

export type SixthPeriodStatus = {
  semester: number;
  filledCount: number;
  requiredCount: number;
  isMet: boolean;
};

export type CourseLoadRequirements = {
  semesterCredits: SemesterCreditStatus[];
  sixthPeriod: SixthPeriodStatus[];
};

export type LunchLength = "Full Lunch" | "Half Lunch";

export type SemesterLunchLength = {
  semester: number;
  lunchLength: LunchLength;
};

export type LunchLengthResult = {
  semesters: SemesterLunchLength[];
};

export function computeSemesterCredits(plannedCourses: PlannedCourse[]): SemesterCreditStatus[] {
  const credits: Record<number, number> = { 1: 0, 2: 0 };
  const seen = new Set<string>();

  for (const pc of plannedCourses) {
    if (pc.course.isNonAcademic) continue;
    if (isOutOfSemester(pc.semester)) continue;

    const key = `${pc.courseId ?? ""}:${pc.slot}:${pc.semester}`;
    if (seen.has(key)) continue;
    seen.add(key);

    credits[pc.semester] += effectiveSlotSpan(pc);
  }

  const requiredCredits = 5;
  return [1, 2].map((sem) => ({
    semester: sem,
    earnedCredits: credits[sem],
    requiredCredits,
    isMet: credits[sem] >= requiredCredits,
  }));
}

export function computeSixthPeriod(plannedCourses: PlannedCourse[], grade: number): SixthPeriodStatus[] {
  const perSemester: Record<number, number> = { 1: 0, 2: 0 };
  const countedFullYear = new Set<string>();

  for (const pc of plannedCourses) {
    if (pc.course.isNonAcademic && grade < 11) continue;
    if (isOutOfSemester(pc.semester)) continue;

    if (pc.course.duration === 2) {
      const span = effectiveSlotSpan(pc);
      for (let i = 0; i < span; i++) {
        const key = `${pc.courseId}-${pc.slot}-${i}`;
        if (!countedFullYear.has(key)) {
          countedFullYear.add(key);
          perSemester[1]++;
          perSemester[2]++;
        }
      }
    } else {
      perSemester[pc.semester]++;
    }
  }

  const requiredCount = 6;
  return [1, 2].map((sem) => ({
    semester: sem,
    filledCount: perSemester[sem],
    requiredCount,
    isMet: perSemester[sem] >= requiredCount,
  }));
}

export function computeCourseLoadRequirements(
  plannedCourses: PlannedCourse[],
  grade: number
): CourseLoadRequirements {
  return {
    semesterCredits: computeSemesterCredits(plannedCourses),
    sixthPeriod: computeSixthPeriod(plannedCourses, grade),
  };
}

/**
 * Compute lunch length for each semester based on 1.5-period science courses.
 *
 * Rules:
 * - Half Lunch if: one non-Early Bird 1.5-period science course in the semester,
 *   OR two 1.5-period science courses (regardless of Early Bird status).
 * - Full Lunch otherwise.
 */
export function computeLunchLength(plannedCourses: PlannedCourse[]): LunchLengthResult {
  const perSemester: Record<number, PlannedCourse[]> = { 1: [], 2: [] };

  for (const pc of plannedCourses) {
    if (isOutOfSemester(pc.semester)) continue;
    if (pc.semester !== 1 && pc.semester !== 2) continue;
    if (!isOnePointFivePeriodScienceCourse(pc.course)) continue;
    perSemester[pc.semester].push(pc);
  }

  const semesters: SemesterLunchLength[] = [1, 2].map((semester) => {
    const courses = perSemester[semester];
    const lunchLength = computeSemesterLunchLength(courses);
    return { semester, lunchLength };
  });

  return { semesters };
}

function computeSemesterLunchLength(courses: PlannedCourse[]): LunchLength {
  if (courses.length === 0) return "Full Lunch";
  if (courses.length === 1) {
    return courses[0].isEarlyBird ? "Full Lunch" : "Half Lunch";
  }
  return courses.every((c) => c.isEarlyBird) ? "Full Lunch" : "Half Lunch";
}

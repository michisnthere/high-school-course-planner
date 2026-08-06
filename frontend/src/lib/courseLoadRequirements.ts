import type { PlannedCourse } from "./planner";
import { effectiveSlotSpan, getCourseCredits, getPlacementKey, getSemesterCredits } from "./courseCredits";
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

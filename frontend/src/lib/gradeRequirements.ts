import type { PlannerCourseDetails } from "./planner";

export type RequirementStatus = {
  category: string;
  requiredCredits: number;
  earnedCredits: number;
  isMet: boolean;
};

export type PeSemesterStatus = {
  semester: number;
  isMet: boolean;
  courseTitle: string | null;
};

export function computeEffectivePeStatus(
  pePerSemester: PeSemesterStatus[],
  peWaivers: { type: string }[]
): PeSemesterStatus[] {
  if (peWaivers.length === 0) return pePerSemester;

  const hasFullWaiver = peWaivers.some((w) => w.type === "academic" || w.type === "athletic");
  const hasMarchingBand = peWaivers.some((w) => w.type === "marching-band");

  return pePerSemester.map((sem) => {
    if (hasFullWaiver) {
      return { ...sem, isMet: true };
    }
    if (hasMarchingBand && sem.semester === 1) {
      return { ...sem, isMet: true };
    }
    return sem;
  });
}

export function courseFulfillsRequirement(course: PlannerCourseDetails, matchTerms: string[]): boolean {
  if (course.title === "Study Hall" || course.title === "Free Period") return false;
  const normalizedTerms = matchTerms.map((t) => t.trim().toLowerCase());
  return (course.fulfillsRequirements ?? []).some((req) =>
    normalizedTerms.includes(req.trim().toLowerCase())
  );
}

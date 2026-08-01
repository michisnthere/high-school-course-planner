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
  requiredLabel: string;
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

export type PeSemesterCell = {
  year: number;
  semester: 1 | 2;
  met: boolean;
  reason: "course" | "waiver" | null;
  courseTitle: string | null;
  requiredLabel: string;
};

export type PeYearRow = {
  year: number;
  semester1: PeSemesterCell;
  semester2: PeSemesterCell;
};

export const PE_YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

type PeBreakdownEntry = {
  semester: number;
  met: boolean;
  courseTitle: string | null;
  requiredLabel: string;
};

type PeResolutionLike = {
  type: string;
  metadata?: Record<string, unknown> | null;
};

export function computePeYearRows(
  breakdown: PeBreakdownEntry[],
  resolutions: PeResolutionLike[]
): PeYearRow[] {
  const waivedYears = new Set<number>();
  for (const r of resolutions) {
    if (r.type !== "pe_waiver") continue;
    const year = r.metadata?.year;
    if (typeof year === "number") waivedYears.add(year);
  }

  return [9, 10, 11, 12].map((year) => {
    const base = (year - 9) * 2;
    const makeCell = (localSem: 1 | 2): PeSemesterCell => {
      const entry = breakdown.find((s) => s.semester === base + localSem);
      const met = entry?.met ?? false;
      return {
        year,
        semester: localSem,
        met,
        reason: entry?.courseTitle ? "course" : met ? "waiver" : null,
        courseTitle: entry?.courseTitle ?? null,
        requiredLabel: entry?.requiredLabel ?? "",
      };
    };
    return { year, semester1: makeCell(1), semester2: makeCell(2) };
  });
}

export function courseFulfillsRequirement(course: PlannerCourseDetails, matchTerms: string[]): boolean {
  if (course.isNonAcademic) return false;
  const normalizedTerms = matchTerms.map((t) => t.trim().toLowerCase());
  return (course.fulfillsRequirements ?? []).some((req) =>
    normalizedTerms.includes(req.trim().toLowerCase())
  );
}

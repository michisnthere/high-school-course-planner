import type { PlannedCourse, PlannerCourseDetails } from "./planner";

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

function peWaiverVariant(w: { type: string; metadata?: Record<string, unknown> | null }): string | undefined {
  const variant = w.metadata?.variant;
  return typeof variant === "string" ? variant : undefined;
}

export function computeEffectivePeStatus(
  pePerSemester: PeSemesterStatus[],
  peWaivers: { type: string; metadata?: Record<string, unknown> | null }[]
): PeSemesterStatus[] {
  if (peWaivers.length === 0) return pePerSemester;

  const hasFullWaiver = peWaivers.some(
    (w) => w.type === "academic" || w.type === "athletic" || peWaiverVariant(w) === "academic" || peWaiverVariant(w) === "athletic"
  );
  const hasMarchingBand = peWaivers.some(
    (w) => w.type === "marching-band" || peWaiverVariant(w) === "marching-band"
  );

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

function courseMatchesPeDanceDriverEd(course: PlannerCourseDetails): boolean {
  const terms = ["Physical Education", "Dance", "Driver Education"];
  const tokens = [
    course.title,
    ...(course.fulfillsRequirements ?? []),
    course.department ?? "",
    course.division ?? "",
  ]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return terms.some((term) => {
    const needle = term.toLowerCase();
    return tokens.some(
      (token) => token === needle || token.includes(needle) || needle.includes(token)
    );
  });
}

function courseMatchesFreshmanFF(course: PlannerCourseDetails): boolean {
  return course.title.toLowerCase().replace(/\*/g, "").trim().includes("foundational fitness");
}

// Original Year-Level PE calculation: per-year, from the year's own scheduled
// courses. Grade 9 requires Freshman Foundational Fitness in semester 1 and any
// PE/Dance/Driver Education in semester 2; grades 10-12 are satisfied by any
// two PE/Dance/Driver Education semesters. This is intentionally independent
// from the semester grid used by the Graduation Requirements PE card.
export function computePePerSemester(
  plannedCourses: PlannedCourse[],
  grade?: number
): PeSemesterStatus[] {
  const semTitles: Record<number, string | null> = { 1: null, 2: null };
  const fullYearDone = new Set<string>();

  const isGrade9 = grade === 9;

  for (const pc of plannedCourses) {
    if (pc.courseId == null) continue;

    const isFreshmanFF = courseMatchesFreshmanFF(pc.course);
    const matchesStandard = courseMatchesPeDanceDriverEd(pc.course);

    if (isGrade9) {
      if (isFreshmanFF && (pc.semester === 1 || pc.course.duration === 2) && !semTitles[1]) {
        semTitles[1] = pc.course.title;
      }
      if (matchesStandard && (pc.semester === 2 || pc.course.duration === 2) && !semTitles[2]) {
        semTitles[2] = pc.course.title;
      }
    } else {
      if (!matchesStandard) continue;

      if (pc.course.duration === 2) {
        const key = `${pc.courseId}-${pc.slot}`;
        if (fullYearDone.has(key)) continue;
        fullYearDone.add(key);
        const title = pc.course.title;
        if (!semTitles[1]) semTitles[1] = title;
        if (!semTitles[2]) semTitles[2] = title;
      } else {
        if (!semTitles[pc.semester]) {
          semTitles[pc.semester] = pc.course.title;
        }
      }
    }
  }

  return [1, 2].map((sem) => ({
    semester: sem,
    isMet: semTitles[sem] != null,
    courseTitle: semTitles[sem],
    requiredLabel: "Physical Education",
  }));
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

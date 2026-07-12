import type { PlannerCourseDetails, PlannedCourse } from "./planner";

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
  peDanceDriverEd: {
    isMet: boolean;
    detail: string;
  };
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function courseTokens(course: PlannerCourseDetails): string[] {
  return [
    course.title,
    ...(course.fulfillsRequirements ?? []),
    course.department ?? "",
    course.division ?? "",
  ]
    .map(normalize)
    .filter(Boolean);
}

function matchesAny(course: PlannerCourseDetails, terms: string[]): boolean {
  const tokens = courseTokens(course);
  return terms.some((term) => {
    const needle = normalize(term);
    return tokens.some((token) => token === needle || token.includes(needle) || needle.includes(token));
  });
}

export function computeSemesterCredits(plannedCourses: PlannedCourse[]): SemesterCreditStatus[] {
  const credits: Record<number, number> = { 1: 0, 2: 0 };
  const countedFullYear = new Set<string>();

  for (const pc of plannedCourses) {
    if (pc.course.title === "Study Hall" || pc.course.title === "Free Period") continue;

    if (pc.course.duration === 2) {
      const key = `${pc.courseId}-${pc.slot}`;
      if (!countedFullYear.has(key)) {
        countedFullYear.add(key);
        const totalCredits = pc.course.credits ?? pc.course.duration;
        const perSemester = totalCredits / 2;
        credits[1] += perSemester;
        credits[2] += perSemester;
      }
    } else {
      const value = pc.course.credits ?? pc.course.duration;
      credits[pc.semester] += value;
    }
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
    if (pc.course.title === "Free Period" && grade < 11) continue;

    if (pc.course.duration === 2) {
      const key = `${pc.courseId}-${pc.slot}`;
      if (!countedFullYear.has(key)) {
        countedFullYear.add(key);
        perSemester[1]++;
        perSemester[2]++;
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

export function computePeDanceDriverEd(plannedCourses: PlannedCourse[]): {
  isMet: boolean;
  detail: string;
} {
  const matchedCourses: string[] = [];
  const countedIds = new Set<number>();

  for (const pc of plannedCourses) {
    if (pc.courseId == null) continue;
    if (countedIds.has(pc.courseId)) continue;

    if (matchesAny(pc.course, ["Physical Education", "Dance", "Driver Education"])) {
      countedIds.add(pc.courseId);
      matchedCourses.push(pc.course.title);
    }
  }

  const uniqueTitles = [...new Set(matchedCourses)];
  return {
    isMet: uniqueTitles.length > 0,
    detail: uniqueTitles.length > 0 ? uniqueTitles.join(", ") : "None planned",
  };
}

export function computeCourseLoadRequirements(
  plannedCourses: PlannedCourse[],
  grade: number
): CourseLoadRequirements {
  return {
    semesterCredits: computeSemesterCredits(plannedCourses),
    sixthPeriod: computeSixthPeriod(plannedCourses, grade),
    peDanceDriverEd: computePeDanceDriverEd(plannedCourses),
  };
}

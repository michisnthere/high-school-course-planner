import type { PlannedCourse, PlannerCourseDetails } from "./planner";
import { getCourseCredits, getPlacementKey } from "./courseCredits";

export function courseFulfillsRequirement(course: PlannerCourseDetails, matchTerms: string[]): boolean {
  if (course.title === "Study Hall" || course.title === "Free Period") return false;
  const normalizedTerms = matchTerms.map((t) => t.trim().toLowerCase());
  return (course.fulfillsRequirements ?? []).some((req) =>
    normalizedTerms.includes(req.trim().toLowerCase())
  );
}

export type GradeRequirement = {
  category: string;
  credits: number;
  matches?: string[];
};

export type GradeRequirements = {
  grade: number;
  requirements: GradeRequirement[];
};

export const GRADE_REQUIREMENTS: GradeRequirements[] = [
  {
    grade: 9,
    requirements: [
      {
        category: "Communication Arts",
        credits: 1,
        matches: ["English"],
      },
      {
        category: "Mathematics",
        credits: 1,
        matches: ["Mathematics"],
      },
      {
        category: "Science",
        credits: 1,
        matches: ["Biology", "Physical Science"],
      },
    ],
  },
  {
    grade: 10,
    requirements: [
      {
        category: "Communication Arts",
        credits: 1,
        matches: ["English"],
      },
      {
        category: "Mathematics",
        credits: 1,
        matches: ["Mathematics"],
      },
      {
        category: "Science",
        credits: 1,
        matches: ["Biology", "Physical Science"],
      },
    ],
  },
  {
    grade: 11,
    requirements: [
      {
        category: "Communication Arts",
        credits: 1,
        matches: ["English"],
      },
      {
        category: "Mathematics",
        credits: 1,
        matches: ["Mathematics"],
      },
    ],
  },
  {
    grade: 12,
    requirements: [
      {
        category: "Communication Arts",
        credits: 1,
        matches: ["English"],
      },
    ],
  },
];

export type RequirementStatus = {
  category: string;
  requiredCredits: number;
  earnedCredits: number;
  isMet: boolean;
};

export function getGradeRequirements(grade: number): GradeRequirement[] {
  return GRADE_REQUIREMENTS.find((entry) => entry.grade === grade)?.requirements ?? [];
}

export function getRequirementStatus(
  grade: number,
  plannedCourses: PlannedCourse[]
): RequirementStatus[] {
  const requirements = getGradeRequirements(grade);
  if (requirements.length === 0) {
    return [];
  }

  const instanceMap = new Map<string, PlannedCourse>();
  for (const plannedCourse of plannedCourses) {
    if (plannedCourse.courseId == null) continue;
    const key = getPlacementKey(plannedCourse);
    if (!instanceMap.has(key)) {
      instanceMap.set(key, plannedCourse);
    }
  }

  return requirements.map((requirement) => {
    const matchTerms = requirement.matches ?? [requirement.category];
    let earnedCredits = 0;

    for (const plannedCourse of instanceMap.values()) {
      const { course } = plannedCourse;
      if (courseFulfillsRequirement(course, matchTerms)) {
        earnedCredits += getCourseCredits(course);
      }
    }

    return {
      category: requirement.category,
      requiredCredits: requirement.credits,
      earnedCredits,
      isMet: earnedCredits >= requirement.credits,
    };
  });
}

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

export type PeSemesterStatus = {
  semester: number;
  isMet: boolean;
  courseTitle: string | null;
};

function courseMatchesFreshmanFF(course: PlannerCourseDetails): boolean {
  return course.title.toLowerCase().replace(/\*/g, "").trim().includes("foundational fitness");
}

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
  }));
}

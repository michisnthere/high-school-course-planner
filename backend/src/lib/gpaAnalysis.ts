import { prisma } from "./prisma.js";
import type {
  Course,
  CourseOffering,
  CourseOption,
  CompletedCourse,
  Planner,
  PlannedCourse,
  PlannerOption,
} from "@prisma/client";

type CourseOptionWithOfferings = CourseOption & { offerings: CourseOffering[] };
type CourseWithOptions = Course & {
  options: CourseOptionWithOfferings[];
  department?: { name: string; division?: { name: string } | null } | null;
};

type CompletedCourseWithCourse = CompletedCourse & {
  course: CourseWithOptions;
};

type PlannedCourseWithRelations = PlannedCourse & {
  course: CourseWithOptions | null;
  plannerOption: PlannerOption | null;
  planner: Planner;
};

type GpaEntry = {
  courseId: number;
  title: string;
  credits: number;
  creditType: string | null;
  gpaWaiverOption: boolean;
  weightedPoints: number;
  unweightedPoints: number;
};

export type GpaSummary = {
  weighted: number;
  unweighted: number;
  credits: number;
};

export type GpaProjection = {
  current: GpaSummary;
  projected: GpaSummary;
};

const LETTER_GRADE_POINTS: Record<string, number> = {
  A: 4.0,
  B: 3.0,
  C: 2.0,
  D: 1.0,
  F: 0,
};

const WEIGHTED_MULTIPLIERS: Record<string, Record<string, number>> = {
  "college prep": { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0 },
  accelerated: { A: 4.5, B: 3.5, C: 2.5, D: 1.5, F: 0 },
  honors: { A: 5.0, B: 4.0, C: 3.0, D: 2.0, F: 0 },
  ap: { A: 5.0, B: 4.0, C: 3.0, D: 2.0, F: 0 },
};

const DEFAULT_WEIGHTED: Record<string, number> = {
  A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0,
};

function normalizeCreditType(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (normalized.includes("ap")) return "AP";
  if (normalized.includes("honors")) return "Honors";
  if (normalized.includes("accelerated")) return "Accelerated";
  if (normalized.includes("college prep")) return "College Prep";
  return trimmed;
}

function getWeightedPoints(creditType: string | null, letterGrade: string | null): number {
  if (!letterGrade) return 0;
  const grade = letterGrade.toUpperCase();
  const points = LETTER_GRADE_POINTS[grade];
  if (points == null) return 0;
  if (!creditType) return points;
  const normalized = creditType.toLowerCase();
  let multiplier: Record<string, number> | undefined;
  if (normalized.includes("ap") || normalized.includes("honors")) {
    multiplier = WEIGHTED_MULTIPLIERS.ap;
  } else if (normalized.includes("accelerated")) {
    multiplier = WEIGHTED_MULTIPLIERS.accelerated;
  } else {
    multiplier = WEIGHTED_MULTIPLIERS["college prep"];
  }
  return multiplier?.[grade] ?? DEFAULT_WEIGHTED[grade] ?? 0;
}

function getUnweightedPoints(letterGrade: string | null): number {
  if (!letterGrade) return 0;
  return LETTER_GRADE_POINTS[letterGrade.toUpperCase()] ?? 0;
}

function deriveCourseCredits(course: CourseWithOptions): number {
  const option = course.options[0];
  if (option?.credits != null) return option.credits;
  if (course.duration != null) return course.duration;
  return 1;
}

function toAnalysisCourse(course: CourseWithOptions, letterGrade: string | null): GpaEntry {
  const option = course.options[0];
  const creditType = normalizeCreditType(option?.creditType ?? null);
  const credits = deriveCourseCredits(course);

  return {
    courseId: course.id,
    title: course.title,
    credits,
    creditType,
    gpaWaiverOption: Boolean(option?.gpaWaiverOption),
    weightedPoints: getWeightedPoints(creditType, letterGrade),
    unweightedPoints: getUnweightedPoints(letterGrade),
  };
}

function computeSummary(entries: GpaEntry[]): GpaSummary {
  const included = entries.filter((entry) => !entry.gpaWaiverOption);
  const credits = included.reduce((sum, entry) => sum + entry.credits, 0);
  const weightedTotal = included.reduce((sum, entry) => sum + entry.weightedPoints * entry.credits, 0);
  const unweightedTotal = included.reduce((sum, entry) => sum + entry.unweightedPoints * entry.credits, 0);

  return {
    weighted: credits > 0 ? weightedTotal / credits : 0,
    unweighted: credits > 0 ? unweightedTotal / credits : 0,
    credits,
  };
}

function dedupePlannedCourses(placements: PlannedCourseWithRelations[]): GpaEntry[] {
  const seen = new Set<string>();
  const entries: GpaEntry[] = [];

  for (const placement of placements) {
    if (!placement.course) continue;
    const course = toAnalysisCourse(placement.course, "A");
    const key = course.weightedPoints === 0 && course.credits <= 0 ? `${placement.id}` : "";
    const dedupeKey =
      placement.course.duration === 2
        ? `${placement.course.id}-${placement.plannerId}-${placement.slot}`
        : `${placement.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    entries.push(course);
  }

  return entries;
}

async function loadCompletedCourses(userId: number): Promise<CompletedCourseWithCourse[]> {
  return prisma.completedCourse.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          department: {
            include: {
              division: true,
            },
          },
          options: {
            include: {
              offerings: true,
            },
          },
        },
      },
    },
  });
}

async function loadPlannedCourses(userId: number): Promise<PlannedCourseWithRelations[]> {
  const planners = await prisma.planner.findMany({
    where: { userId },
    include: {
      plannedCourses: {
        include: {
          course: {
            include: {
              department: {
                include: {
                  division: true,
                },
              },
              options: {
                include: {
                  offerings: true,
                },
              },
            },
          },
          plannerOption: true,
        },
      },
    },
    orderBy: { schoolYear: "asc" },
  });

  return planners.flatMap((planner) =>
    planner.plannedCourses.map((planned) => ({
      ...planned,
      planner,
    }))
  );
}

export async function analyzeGpa(userId: number): Promise<GpaProjection> {
  const [completedCourses, plannedCourses] = await Promise.all([
    loadCompletedCourses(userId),
    loadPlannedCourses(userId),
  ]);

  const completedEntries = completedCourses.map((cc) =>
    toAnalysisCourse(cc.course, cc.letterGrade)
  );
  const plannedEntries = dedupePlannedCourses(plannedCourses);

  return {
    current: computeSummary(completedEntries),
    projected: computeSummary([...completedEntries, ...plannedEntries]),
  };
}

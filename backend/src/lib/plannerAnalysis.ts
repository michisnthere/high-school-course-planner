// ---------------------------------------------------------------------------
// Planner Analysis Engine
//
// Analyzes all planners (grades 9–12) for a student and produces a single
// structured object containing graduation progress, yearly requirements,
// duplicate detection, prerequisite status, and planner statistics.
//
// This module intentionally does not modify UI code. It is a pure backend
// analysis service that can be consumed by any client surface.
// ---------------------------------------------------------------------------

import { prisma } from "./prisma.js";
import type {
  Course,
  CourseOption,
  CourseOffering,
  CompletedCourse,
  GraduationRequirement,
  PlannedCourse,
  Planner,
  PlannerOption,
  SummerCourse,
  SummerCourseRequirement,
  SummerCourseSession,
} from "@prisma/client";
import {
  canonicalRequirementName,
  isMeasurableGraduationRequirementName,
  normalizeRequirementNames,
  type InformationItem,
} from "./requirementsCleanup.js";
import { normalizePrerequisite } from "./prerequisiteNormalization.js";
import { deriveCourseDuration, calculateTotalCredits, effectiveSlotsPerSemester } from "./courseCredits.js";
import { GRADE_LEVEL_REQUIREMENTS } from "./gradeLevelRequirements.js";

type CourseOptionWithOfferings = CourseOption & { offerings: CourseOffering[] };
type CourseWithOptions = Course & {
  options: CourseOptionWithOfferings[];
  department?: { name: string; division?: { name: string } | null } | null;
};

type SummerCourseWithRelations = SummerCourse & {
  sessions: SummerCourseSession[];
  requirement: Array<SummerCourseRequirement & { graduationRequirement: GraduationRequirement }>;
  regularCourse: CourseWithOptions | null;
};

type PlannedCourseWithRelations = PlannedCourse & {
  course: CourseWithOptions | null;
  summerCourse: SummerCourseWithRelations | null;
  plannerOption: PlannerOption | null;
  planner: Planner;
};

type CompletedCourseWithCourse = CompletedCourse & {
  course: CourseWithOptions | null;
  summerCourse: SummerCourseWithRelations | null;
};

type AnalysisCourse = {
  id: number;
  title: string;
  courseCode: string | null;
  duration: number;
  credits: number;
  slotSpan: number;
  division: string | null;
  department: string | null;
  fulfillsRequirements: string[];
  requirementCredits: Record<string, number>;
  prerequisites: string[];
  peEligible: boolean;
  isFoundationalFitness: boolean;
  isRepeatable: boolean;
  // Summer School identity. isSummer marks a SummerCourse-backed placement.
  // equivalentRegularCourseId carries the SummerCourse.regularCourseId link so
  // a matched summer course is recognized as the same course as its regular
  // equivalent (for duplicate detection and no-double-count).
  isSummer: boolean;
  summerCourseId: number | null;
  equivalentRegularCourseId: number | null;
  duplicateGroupId: number;
};

type CoursePlacement = {
  plannedCourseId: number;
  year: number;
  semester: number;
  slot: number;
  course: AnalysisCourse | null;
  plannerOption: PlannerOption | null;
  credits: number;
};

export type RecommendedCourse = {
  courseId: number;
  title: string;
  reason: string;
};

export type RequirementStatus = {
  id: number;
  name: string;
  category: string | null;
  requirementType: string | null;
  requiredValue: number | null;
  earnedValue: number;
  remainingValue: number;
  status: "satisfied" | "partial" | "notStarted";
  recommendedCourses: RecommendedCourse[];
};

export type YearRequirementItem = {
  category: string;
  required: boolean;
  met: boolean;
  earnedCredits: number;
  requiredCredits: number;
  matches: string[];
};

export type YearRequirementStatus = {
  grade: number;
  label: string;
  items: YearRequirementItem[];
  satisfiedCount: number;
  totalCount: number;
};

export type DuplicateCourse = {
  courseId: number;
  title: string;
  count: number;
  placements: Array<{ year: number; semester: number[]; slot: number }>;
};

export type MissingPrerequisite = {
  plannedCourseId: number;
  courseTitle: string;
  year: number;
  semester: number;
  missingPrerequisite: string;
  reason: "notPlanned" | "plannedLater";
};

export type PlannerStatistics = {
  coursesScheduled: number;
  freeSlotsRemaining: number;
  studyHallCount: number;
  freePeriodCount: number;
};

export type ResolutionInfo = {
  id: number;
  type: string;
  courseId: number | null;
  metadata: Record<string, unknown>;
};

export type PeSemesterBreakdown = {
  semester: number;
  met: boolean;
  courseTitle: string | null;
  courseId: number | null;
  requiredLabel: string;
};

export type PlannerAnalysis = {
  credits: {
    total: number;
    byRequirementCategory: Record<string, number>;
    byDivision: Record<string, number>;
  };
  // Actual / earned progress: only coursework the student has actually completed
  // (CompletedCourse records, plus completed summer-school / middle-school
  // resolutions). Planned placements from incomplete years are NOT included,
  // so these values reflect what has genuinely been earned so far.
  earned?: {
    credits: {
      total: number;
      byRequirementCategory: Record<string, number>;
      byDivision: Record<string, number>;
    };
    graduationRequirements: RequirementStatus[];
  };
  // Projected / planned progress: actual completed coursework plus planned
  // placements from incomplete years. This is what the planner uses to answer
  // "if I keep this schedule, will I graduate?"
  graduationRequirements: RequirementStatus[];
  informationItems: InformationItem[];
  yearRequirements: YearRequirementStatus[];
  peSemesterBreakdown: PeSemesterBreakdown[];
  duplicateCourses: DuplicateCourse[];
  missingPrerequisites: MissingPrerequisite[];
  plannerStatistics: PlannerStatistics;
  resolutions: ResolutionInfo[];
};

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

const SLOTS_PER_SEMESTER = 7;
const SEMESTERS_PER_YEAR = 2;
const YEARS = [9, 10, 11, 12] as const;



function toAnalysisCourse(course: CourseWithOptions): AnalysisCourse {
  const option = course.options[0];
  const rawPrereqs: unknown = option?.offerings?.[0]?.prerequisites;
  const prerequisites = new Set<string>();
  if (Array.isArray(rawPrereqs)) {
    for (const item of rawPrereqs) {
      if (typeof item === "string" && item.trim()) {
        prerequisites.add(normalizePrerequisite(item.trim()));
      }
    }
  }

  const fulfillsRequirements = Array.isArray(course.fulfillsRequirements)
    ? normalizeRequirementNames(course.fulfillsRequirements.filter((r): r is string => typeof r === "string"))
    : [];

  const fulfillsCanonicalSet = new Set(fulfillsRequirements);
  const requirementCredits: Record<string, number> = {};
  const rawRequirementCredits = course.requirementCredits;
  if (rawRequirementCredits && typeof rawRequirementCredits === "object" && !Array.isArray(rawRequirementCredits)) {
    for (const [raw, value] of Object.entries(rawRequirementCredits)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
      const canonical = canonicalRequirementName(raw);
      if (fulfillsCanonicalSet.has(canonical)) requirementCredits[canonical] = value;
    }
  }

  const courseCode = option?.offerings?.[0]?.courseCode ?? null;

  const attrs = Array.isArray(course.attributes)
    ? course.attributes
    : typeof course.attributes === "object" && course.attributes !== null
      ? Object.entries(course.attributes).filter(([, v]) => v === true).map(([k]) => k)
      : [];

  const fulfillsLower = fulfillsRequirements.map((r) => r.toLowerCase());
  const peEligible =
    fulfillsLower.some((r) => r === "physical education" || r === "driver education") ||
    attrs.includes("satisfiesPeRequirement");

  const isFoundationalFitness =
    attrs.includes("freshmanFoundationalFitness") ||
    course.title.toLowerCase().includes("foundational fitness");

  return {
    id: course.id,
    title: course.title,
    courseCode,
    duration: deriveCourseDuration(course),
    credits: calculateTotalCredits(course),
    slotSpan: effectiveSlotsPerSemester(course),
    division: course.department?.division?.name ?? null,
    department: course.department?.name ?? null,
    fulfillsRequirements,
    requirementCredits,
    prerequisites: Array.from(prerequisites),
    peEligible,
    isFoundationalFitness,
    isRepeatable: course.isRepeatable === true,
    isSummer: false,
    summerCourseId: null,
    equivalentRegularCourseId: null,
    duplicateGroupId: course.id,
  };
}

// SummerCourse analysis ids live in a deterministic negative namespace so they
// never collide with regular course ids (SummerCourse ids overlap the regular
// 1-223 range). = -(10000 + summerCourse.id).
const SUMMER_ID_OFFSET = 10000;
function toAnalysisSummerId(summerCourseId: number): number {
  return -(SUMMER_ID_OFFSET + summerCourseId);
}

function toAnalysisSummerCourse(summerCourse: SummerCourseWithRelations): AnalysisCourse {
  const fulfillsRequirements = [
    ...new Set(
      summerCourse.requirement.map((r) => canonicalRequirementName(r.graduationRequirement.name))
    ),
  ];
  const fulfillsCanonicalSet = new Set(fulfillsRequirements);

  // Reuse the matched regular course's requirementCredits split when available;
  // otherwise leave empty so the legacy full-credit-per-fulfilled-requirement
  // fallback applies (SummerCourse has no requirementCredits of its own).
  const requirementCredits: Record<string, number> = {};
  const matched = summerCourse.regularCourse;
  if (matched) {
    const raw = matched.requirementCredits;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [rawKey, value] of Object.entries(raw)) {
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
        const canonical = canonicalRequirementName(rawKey);
        if (fulfillsCanonicalSet.has(canonical)) requirementCredits[canonical] = value;
      }
    }
  }

  const prerequisites = new Set<string>();
  if (Array.isArray(summerCourse.prerequisites)) {
    for (const item of summerCourse.prerequisites) {
      if (typeof item === "string" && item.trim()) {
        prerequisites.add(normalizePrerequisite(item.trim()));
      }
    }
  }

  const fulfillsLower = fulfillsRequirements.map((r) => r.toLowerCase());
  const peEligible = fulfillsLower.some((r) => r === "physical education" || r === "driver education");

  // Inherit retakeability + department from the matched regular course when it
  // exists so the existing repeatable one-semester PE exemption applies.
  const isRepeatable = matched?.isRepeatable === true;
  const department = matched?.department?.name ?? null;

  const id = toAnalysisSummerId(summerCourse.id);
  return {
    id,
    title: summerCourse.title,
    courseCode: summerCourse.courseCode ?? null,
    duration: summerCourse.duration === "full_summer" ? 2 : 1,
    credits: summerCourse.credits ?? 0,
    slotSpan: 1,
    division: matched?.department?.division?.name ?? null,
    department,
    fulfillsRequirements,
    requirementCredits,
    prerequisites: Array.from(prerequisites),
    peEligible,
    isFoundationalFitness: false,
    isRepeatable,
    isSummer: true,
    summerCourseId: summerCourse.id,
    equivalentRegularCourseId: matched?.id ?? null,
    duplicateGroupId: matched?.id ?? id,
  };
}

function isStudyHall(option: PlannerOption | null): boolean {
  return option?.isNonAcademic === true && option?.name === "Study Hall";
}

function isFreePeriod(option: PlannerOption | null): boolean {
  return option?.isNonAcademic === true && option?.name === "Free Period";
}

function isAcademicCourse(placement: CoursePlacement): boolean {
  return placement.course != null && placement.plannerOption?.isNonAcademic !== true;
}

function getPlacementKey(placement: CoursePlacement): string {
  if (placement.course?.duration === 2) {
    return `${placement.year}-${placement.course.id}`;
  }
  return `${placement.year}-${placement.course?.id ?? placement.plannerOption?.id}-${placement.semester}-${placement.slot}`;
}

function getCourseKey(placement: CoursePlacement): string | null {
  if (!placement.course) return null;
  // Count full-year courses once per year regardless of semester.
  if (placement.course.duration === 2) {
    return `${placement.year}-${placement.course.id}`;
  }
  return `${placement.year}-${placement.course.id}-${placement.semester}-${placement.slot}`;
}

function getRequirementStatus(earned: number, required: number): RequirementStatus["status"] {
  if (earned >= required) return "satisfied";
  if (earned > 0) return "partial";
  return "notStarted";
}

// ---------------------------------------------------------------------------
// Per-requirement credit allocation
//
// Courses that fulfill multiple graduation requirements (e.g., American Studies
// fulfills English AND U.S. History) must not have their full credit value
// applied to every requirement. `requirementCredits` on the course defines the
// exact per-requirement split. Courses without that field fall back to the
// legacy behavior: the full credit value is applied to each fulfilled
// requirement (safe for single-fulfillment courses).
// ---------------------------------------------------------------------------

function getAllocatedCreditsForCourse(course: AnalysisCourse, canonicalName: string): number {
  const rc = course.requirementCredits ?? {};
  if (Object.keys(rc).length > 0) {
    return rc[canonicalName] ?? 0;
  }
  const fulfills = course.fulfillsRequirements.map((r) => canonicalRequirementName(r));
  return fulfills.includes(canonicalName) ? course.credits : 0;
}

// Build per-course, per-requirement allocated credits from placements and
// resolution credits (summer school / middle school).
function buildCourseAllocatedCredits(
  placements: CoursePlacement[],
  resolutions: ResolutionInfo[],
  courseFulfillsMap: Map<number, Set<string>>
): Map<number, Map<string, number>> {
  const courseAllocatedCredits = new Map<number, Map<string, number>>();
  const allocSeen = new Set<string>();
  for (const placement of placements) {
    if (!placement.course) continue;
    const key = getBackendPlacementKey(placement);
    if (allocSeen.has(key)) continue;
    allocSeen.add(key);
    const course = placement.course;
    if (!courseAllocatedCredits.has(course.id)) courseAllocatedCredits.set(course.id, new Map());
    const allocMap = courseAllocatedCredits.get(course.id)!;
    for (const fr of course.fulfillsRequirements) {
      const canonical = canonicalRequirementName(fr);
      allocMap.set(canonical, (allocMap.get(canonical) ?? 0) + getAllocatedCreditsForCourse(course, canonical));
    }
  }

  // Distribute resolution credits across the course's requirement allocation so
  // they never inflate every fulfilled requirement.
  for (const resolution of resolutions) {
    if (resolution.type !== "summer_school" && resolution.type !== "middle_school") continue;
    const courseId = resolution.courseId;
    const metaCredits = resolution.metadata?.credits as number | undefined;
    if (!courseId || !metaCredits) continue;
    const allocMap = courseAllocatedCredits.get(courseId);
    const fulfills = courseFulfillsMap.get(courseId);
    if (!allocMap || !fulfills || fulfills.size === 0) continue;
    const total = Array.from(allocMap.values()).reduce((a, b) => a + b, 0);
    if (total <= 0) {
      for (const fr of fulfills) allocMap.set(fr, (allocMap.get(fr) ?? 0) + metaCredits);
      continue;
    }
    for (const [req, value] of allocMap) {
      allocMap.set(req, value + (metaCredits * value) / total);
    }
  }

  return courseAllocatedCredits;
}

async function loadPlacements(userId: number): Promise<CoursePlacement[]> {
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
          summerCourse: {
            include: {
              sessions: true,
              requirement: {
                include: {
                  graduationRequirement: true,
                },
              },
              regularCourse: {
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
          },
          plannerOption: true,
        },
      },
    },
    orderBy: { schoolYear: "asc" },
  });

  const placements: CoursePlacement[] = [];
  for (const planner of planners) {
    for (const planned of planner.plannedCourses) {
      const course = planned.course
        ? toAnalysisCourse(planned.course)
        : planned.summerCourse
          ? toAnalysisSummerCourse(planned.summerCourse)
          : null;
      const credits = course?.credits ?? planned.plannerOption?.credits ?? 0;
      placements.push({
        plannedCourseId: planned.id,
        year: planner.schoolYear,
        semester: planned.semester,
        slot: planned.slot,
        course,
        plannerOption: planned.plannerOption,
        credits,
      });
    }
  }
  return placements;
}

async function loadGraduationRequirements(): Promise<GraduationRequirement[]> {
  return prisma.graduationRequirement.findMany({
    orderBy: { id: "asc" },
  });
}

async function loadCourseRequirementLinks(): Promise<Map<number, Set<number>>> {
  const links = await prisma.courseRequirement.findMany({
    include: { course: true, graduationRequirement: true },
  });
  const map = new Map<number, Set<number>>();
  for (const link of links) {
    const set = map.get(link.graduationRequirementId) ?? new Set<number>();
    set.add(link.courseId);
    map.set(link.graduationRequirementId, set);
  }
  return map;
}

async function loadAllCourses(): Promise<CourseWithOptions[]> {
  return prisma.course.findMany({
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
    orderBy: { title: "asc" },
  }) as Promise<CourseWithOptions[]>;
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
      summerCourse: {
        include: {
          sessions: true,
          requirement: {
            include: {
              graduationRequirement: true,
            },
          },
          regularCourse: {
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
      },
    },
  });
}

function getBackendPlacementKey(p: CoursePlacement): string {
  if (p.course?.duration === 2) {
    return `fy:${p.course.id}:${p.slot}`;
  }
  return `sem:${p.course!.id}:${p.slot}:${p.semester}:${p.year}`;
}

// A matched summer course (duplicateGroupId set) is equivalent to its regular
// counterpart. If the regular counterpart is also present, the summer seat is a
// duplicate attempt and must not add a second set of credits.
function dropEquivalentSummerDuplicates(sources: CoursePlacement[]): CoursePlacement[] {
  const regularIds = new Set<number>();
  for (const source of sources) {
    if (source.course && !source.course.isSummer) {
      regularIds.add(source.course.id);
    }
  }
  return sources.filter((source) => {
    if (!source.course?.isSummer) return true;
    const equivalent = source.course.duplicateGroupId;
    if (equivalent == null) return true;
    return !regularIds.has(equivalent);
  });
}

// Completed courses (including summer school / middle school) are coursework the
// student has already finished. They count toward graduation requirements and
// overall credits, but must NOT influence year-specific planner requirements
// (course load, PE breakdown, grade 9-12 checks), so they are only merged into
// the credit-source lists used by graduation/credit math.
function buildCompletedCoursePlacements(completedCourses: CompletedCourseWithCourse[]): CoursePlacement[] {
  return completedCourses.map((cc, index) => {
    const course = cc.course
      ? toAnalysisCourse(cc.course)
      : cc.summerCourse
        ? toAnalysisSummerCourse(cc.summerCourse)
        : null;
    return {
      plannedCourseId: -(cc.id || index + 1),
      year: 0,
      semester: 0,
      slot: -1,
      course,
      plannerOption: null,
      credits: cc.credits ?? course?.credits ?? 0,
    };
  });
}

function computeCredits(placements: CoursePlacement[], completedCourses: CompletedCourseWithCourse[] = []) {
  const creditSources = dropEquivalentSummerDuplicates([...placements, ...buildCompletedCoursePlacements(completedCourses)]);
  let total = 0;
  const byRequirementCategory: Record<string, number> = {};
  const byDivision: Record<string, number> = {};
  const seen = new Set<string>();

  for (const placement of creditSources) {
    const course = placement.course;
    if (!course) continue;

    const key = getBackendPlacementKey(placement);
    if (seen.has(key)) continue;
    seen.add(key);

    total += placement.credits;

    for (const req of course.fulfillsRequirements) {
      const canonical = canonicalRequirementName(req);
      byRequirementCategory[canonical] =
        (byRequirementCategory[canonical] ?? 0) + getAllocatedCreditsForCourse(course, canonical);
    }

    const division = course.division ?? "Uncategorized";
    byDivision[division] = (byDivision[division] ?? 0) + placement.credits;
  }

  return { total, byRequirementCategory, byDivision };
}

function toInformationItems(requirements: GraduationRequirement[]): InformationItem[] {
  return requirements
    .filter((req) => {
      const canonicalName = canonicalRequirementName(req.name);
      // Requirements tracked as graduation requirements (by DB flag or by
      // canonical name, e.g. "Physical Education") are not informational items.
      if (isMeasurableGraduationRequirementName(canonicalName)) return false;
      return !req.isMeasurable || req.requiredValue == null;
    })
    .map((req) => {
      let explanation = "";
      if (Array.isArray(req.notes)) {
        explanation = req.notes.map((n: unknown) => String(n)).join("; ");
      } else if (typeof req.notes === "object" && req.notes !== null) {
        explanation = JSON.stringify(req.notes);
      }
      return {
        id: req.id,
        name: canonicalRequirementName(req.name),
        category: req.category,
        requirementType: req.requirementType,
        notes: req.notes,
        sourceReference: req.sourceReference,
        explanation,
      };
    })
    .filter((item, index, items) => items.findIndex((candidate) => candidate.name === item.name) === index);
}

function computeGraduationRequirements(
  requirements: GraduationRequirement[],
  courseRequirementLinks: Map<number, Set<number>>,
  placements: CoursePlacement[],
  completedCourses: CompletedCourseWithCourse[] = [],
  resolutions: ResolutionInfo[] = []
): RequirementStatus[] {
  const creditSources = dropEquivalentSummerDuplicates([
    ...placements,
    ...buildCompletedCoursePlacements(completedCourses),
  ]);
  const courseIdToCredits = new Map<number, number>();
  const seen = new Set<string>();
  for (const placement of creditSources) {
    if (!placement.course) continue;
    const key = getBackendPlacementKey(placement);
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = courseIdToCredits.get(placement.course.id) ?? 0;
    courseIdToCredits.set(placement.course.id, existing + placement.credits);
  }

  // Add credits from summer school and middle school resolutions
  for (const resolution of resolutions) {
    if (resolution.type === "summer_school" || resolution.type === "middle_school") {
      const courseId = resolution.courseId;
      const metaCredits = resolution.metadata?.credits as number | undefined;
      if (courseId && metaCredits) {
        const existing = courseIdToCredits.get(courseId) ?? 0;
        courseIdToCredits.set(courseId, existing + metaCredits);
      }
    }
  }

  const canonicalByName = new Map<string, GraduationRequirement>();
  for (const req of requirements) {
    const canonicalName = canonicalRequirementName(req.name);
    // A requirement is graduation-tracked when the DB marks it measurable OR the
    // canonical name is recognized as measurable (e.g., "Physical Education" is
    // tracked even though the row predates the isMeasurable flag).
    if (req.isMeasurable !== true && !isMeasurableGraduationRequirementName(canonicalName)) continue;
    const existing = canonicalByName.get(canonicalName);
    if (!existing || (existing.requiredValue == null && req.requiredValue != null)) {
      canonicalByName.set(canonicalName, req);
    }
  }

  // Build courseId → fulfills canonical names
  const courseFulfillsMap = new Map<number, Set<string>>();
  for (const placement of creditSources) {
    if (!placement.course) continue;
    if (!courseFulfillsMap.has(placement.course.id)) {
      courseFulfillsMap.set(placement.course.id, new Set());
    }
    for (const fr of placement.course.fulfillsRequirements) {
      courseFulfillsMap.get(placement.course.id)!.add(canonicalRequirementName(fr));
    }
  }

  const OVERFLOW_NAMES = new Set(["Electives", "Additional Credits and P.E.", "Total Credits"]);

  const courseUsedByAnyRequirement = new Set<number>();
  const courseAllocatedCredits = buildCourseAllocatedCredits(creditSources, resolutions, courseFulfillsMap);

  const results = Array.from(canonicalByName.values()).map((req) => {
    const required = req.requiredValue ?? 0;
    let earned = 0;
    const canonicalName = canonicalRequirementName(req.name);
    // "Physical Education" is semester-driven (see peSemesterBreakdown) and is
    // not a credit-based requirement, so it is reported without allocating
    // course credits to it. This keeps overflow buckets ("Additional Credits
    // and P.E.", "Electives") unchanged.
    const isPe = canonicalName === "Physical Education";
    const eligibleCourseIds = new Set<number>();
    if (!isPe) {
      for (const sourceReq of requirements) {
        if (canonicalRequirementName(sourceReq.name) !== canonicalName) continue;
        const links = courseRequirementLinks.get(sourceReq.id);
        if (!links) continue;
        for (const courseId of links) {
          eligibleCourseIds.add(courseId);
        }
      }
    }
    for (const courseId of eligibleCourseIds) {
      const fulfills = courseFulfillsMap.get(courseId);
      if (fulfills && !fulfills.has(canonicalName)) continue;
      const allocated = courseAllocatedCredits.get(courseId)?.get(canonicalName) ?? 0;
      if (allocated > 0) {
        earned += allocated;
        courseUsedByAnyRequirement.add(courseId);
      }
    }

    // Check for PE waiver resolution
    let effectiveRequired = required;
    const hasPeWaiver = resolutions.some(
      (r) => r.type === "pe_waiver" && canonicalName === "Physical Education"
    );
    if (hasPeWaiver) {
      effectiveRequired = 0;
    }

    // A driver_ed_external waiver satisfies the Driver Education requirement even
    // without a planned/completed Driver Education course.
    if (canonicalName === "Driver Education") {
      const hasExternal = resolutions.some(
        (r) => r.type === "pe_waiver" && r.metadata?.variant === "driver_ed_external"
      );
      if (hasExternal) {
        earned = Math.max(earned, 1);
      }
    }

    return {
      id: req.id,
      name: canonicalName,
      category: req.category,
      requirementType: req.requirementType,
      requiredValue: req.requiredValue,
      earnedValue: earned,
      remainingValue: Math.max(0, effectiveRequired - earned),
      status: getRequirementStatus(earned, effectiveRequired),
      recommendedCourses: [],
    };
  });

  // Assign overflow credits from courses not used by any requirement
  let overflowRemaining = 0;
  for (const [courseId, credits] of courseIdToCredits) {
    if (!courseUsedByAnyRequirement.has(courseId)) {
      overflowRemaining += credits;
    }
  }

  if (overflowRemaining > 0) {
    for (const result of results) {
      if (result.name === "Electives") {
        const required = result.requiredValue ?? 0;
        const room = required - result.earnedValue;
        if (room > 0) {
          const overflow = Math.min(overflowRemaining, room);
          result.earnedValue += overflow;
          overflowRemaining -= overflow;
          result.remainingValue = Math.max(0, required - result.earnedValue);
          result.status = getRequirementStatus(result.earnedValue, required);
        }
      }
    }
    for (const result of results) {
      if (result.name === "Additional Credits and P.E." && overflowRemaining > 0) {
        const required = result.requiredValue ?? 0;
        result.earnedValue += overflowRemaining;
        result.remainingValue = Math.max(0, required - result.earnedValue);
        result.status = getRequirementStatus(result.earnedValue, required);
        overflowRemaining = 0;
      }
    }
  }

  return results;
}

function mergeCourseRequirementLinksByCanonicalRequirement(
  requirements: GraduationRequirement[],
  courseRequirementLinks: Map<number, Set<number>>
): Map<number, Set<number>> {
  const canonicalIdByName = new Map<string, number>();
  for (const req of requirements) {
    if (req.isMeasurable !== true) continue;
    const canonicalName = canonicalRequirementName(req.name);
    if (!canonicalIdByName.has(canonicalName)) {
      canonicalIdByName.set(canonicalName, req.id);
    }
  }

  const merged = new Map<number, Set<number>>();
  for (const req of requirements) {
    const canonicalId = canonicalIdByName.get(canonicalRequirementName(req.name));
    if (canonicalId === undefined) continue;
    const sourceLinks = courseRequirementLinks.get(req.id);
    if (!sourceLinks) continue;
    const targetLinks = merged.get(canonicalId) ?? new Set<number>();
    for (const courseId of sourceLinks) {
      targetLinks.add(courseId);
    }
    merged.set(canonicalId, targetLinks);
  }
  return merged;
}

function prerequisiteMatches(
  prereq: string,
  item: { title: string; courseCode?: string | null }
): boolean {
  const normalized = normalizePrerequisite(prereq).toLowerCase();
  const normalizedTitle = item.title.toLowerCase();
  const normalizedCode = (item.courseCode ?? "").toLowerCase();

  const alternatives = normalized.split(/\s+or\s+/);
  for (const alt of alternatives) {
    const trimmed = alt.trim();
    if (!trimmed) continue;
    if (
      normalizedTitle.includes(trimmed) ||
      trimmed.includes(normalizedTitle) ||
      trimmed.includes(normalizedCode)
    ) {
      return true;
    }
  }

  return false;
}

function checkPrerequisiteStatus(
  prerequisites: string[],
  completedItems: { title: string; courseCode: string }[],
  plannedItems: { title: string; courseCode: string }[]
): {
  count: number;
  completedCount: number;
  plannedCount: number;
  allCompleted: boolean;
  allMetOrPlanned: boolean;
} {
  let completedCount = 0;
  let plannedCount = 0;
  const count = prerequisites.filter((p) => p.trim()).length;

  for (const prereq of prerequisites) {
    if (!prereq.trim()) continue;

    const isCompleted = completedItems.some((item) => prerequisiteMatches(prereq, item));
    if (isCompleted) {
      completedCount++;
      continue;
    }

    const isPlanned = plannedItems.some((item) => prerequisiteMatches(prereq, item));
    if (isPlanned) {
      plannedCount++;
    }
  }

  return {
    count,
    completedCount,
    plannedCount,
    allCompleted: count > 0 && completedCount === count,
    allMetOrPlanned: completedCount + plannedCount >= count,
  };
}

function computeRecommendations(
  graduationRequirements: RequirementStatus[],
  courseRequirementLinks: Map<number, Set<number>>,
  placements: CoursePlacement[],
  completedCourses: CompletedCourseWithCourse[],
  allCourses: CourseWithOptions[]
): Map<number, RecommendedCourse[]> {
  const scheduledCourseIds = new Set<number>();
  const analysisCourseById = new Map<number, AnalysisCourse>();

  for (const placement of placements) {
    if (placement.course) {
      scheduledCourseIds.add(placement.course.id);
      if (!analysisCourseById.has(placement.course.id)) {
        analysisCourseById.set(placement.course.id, placement.course);
      }
    }
  }

  for (const course of allCourses) {
    if (!analysisCourseById.has(course.id)) {
      analysisCourseById.set(course.id, toAnalysisCourse(course));
    }
  }

  const completedCourseIds = new Set(
    completedCourses
      .map((cc) => (cc.course ? cc.course.id : cc.summerCourse?.regularCourse?.id ?? null))
      .filter((id): id is number => id != null)
  );
  const completedItems = completedCourses.map((cc) => ({
    title: cc.course?.title ?? cc.summerCourse?.title ?? "",
    courseCode: (cc.course?.options?.[0]?.offerings?.[0]?.courseCode ?? cc.summerCourse?.courseCode ?? "").toLowerCase(),
  }));
  const plannedItems = placements
    .filter((p) => p.course)
    .map((p) => ({
      title: p.course!.title,
      courseCode: (p.course!.courseCode ?? "").toLowerCase(),
    }));

  const recommendations = new Map<number, RecommendedCourse[]>();

  for (const req of graduationRequirements) {
    if (req.status === "satisfied") {
      recommendations.set(req.id, []);
      continue;
    }

    const eligibleIds = courseRequirementLinks.get(req.id);
    if (!eligibleIds) {
      recommendations.set(req.id, []);
      continue;
    }

    const list: Array<RecommendedCourse & { priority: number }> = [];
    for (const courseId of eligibleIds) {
      if (completedCourseIds.has(courseId)) continue;
      if (scheduledCourseIds.has(courseId)) continue;

      const course = analysisCourseById.get(courseId);
      if (!course) continue;

      const status = checkPrerequisiteStatus(course.prerequisites, completedItems, plannedItems);
      if (!status.allMetOrPlanned) continue;

      let reason: string;
      if (status.count === 0) {
        reason = "No prerequisites required";
      } else if (status.allCompleted) {
        reason = "Prerequisites met";
      } else if (status.plannedCount > 0 && status.completedCount === 0) {
        reason = "Prerequisites planned";
      } else {
        reason = "Prerequisites met or planned";
      }

      const priority = status.allCompleted ? 0 : status.plannedCount > 0 ? 1 : 2;
      list.push({ courseId, title: course.title, reason, priority });
    }

    const sorted = list
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 5)
      .map(({ priority, ...rec }) => rec);

    recommendations.set(req.id, sorted);
  }

  return recommendations;
}

const REQUIREMENT_CHILDREN: Record<string, string[]> = {
  "Science": ["Biology", "Physical Science"],
  "Social Studies": ["U.S. History", "World History and Geography", "Government"],
};

function computeYearRequirements(
  placements: CoursePlacement[],
  grCategoryChildren?: Map<string, Set<string>>,
): YearRequirementStatus[] {
  return YEARS.map((grade) => {
    const gradeDef = GRADE_LEVEL_REQUIREMENTS.find((g) => g.grade === grade);
    const items: YearRequirementItem[] = (gradeDef?.items ?? []).map((item) => {
      const canonical = item.canonicalName;
      const accepted = new Set<string>([canonical]);
      const children = grCategoryChildren?.get(canonical);
      if (children) for (const c of children) accepted.add(c);
      const hierarchyChildren = REQUIREMENT_CHILDREN[canonical];
      if (hierarchyChildren) for (const c of hierarchyChildren) accepted.add(c);

      let earnedCredits = 0;
      const seen = new Set<string>();

      for (const placement of placements) {
        if (placement.year !== grade || !placement.course) continue;
        const course = placement.course;
        const fulfillsCanonical = course.fulfillsRequirements.map(canonicalRequirementName);
        if (!fulfillsCanonical.some((fr) => accepted.has(fr))) continue;
        const key = getBackendPlacementKey(placement);
        if (seen.has(key)) continue;
        seen.add(key);
        let placementEarned = 0;
        for (const fr of fulfillsCanonical) {
          if (accepted.has(fr)) {
            placementEarned += getAllocatedCreditsForCourse(course, fr);
          }
        }
        earnedCredits += Math.min(placementEarned, placement.credits);
      }

      return {
        category: item.displayName,
        required: true,
        met: earnedCredits >= item.requiredCredits,
        earnedCredits,
        requiredCredits: item.requiredCredits,
        matches: [],
      };
    });

    const satisfiedCount = items.filter((i) => i.met).length;

    return {
      grade,
      label: YEAR_LABELS[grade],
      items,
      satisfiedCount,
      totalCount: items.length,
    };
  });
}

type PeSemesterMatcher = {
  year: number;
  semester: number;
  label: string;
  matches: (course: AnalysisCourse) => boolean;
};

function isAppliedHealthCourse(course: AnalysisCourse): boolean {
  return (
    course.title.toLowerCase().includes("applied health") ||
    course.fulfillsRequirements.some((r) => canonicalRequirementName(r).toLowerCase().includes("applied health"))
  );
}

const PE_SEMESTER_DEFS: PeSemesterMatcher[] = [
  { year: 9, semester: 1, label: "Freshman Foundational Fitness or waiver", matches: (c) => c.isFoundationalFitness },
  { year: 9, semester: 2, label: "Physical Education or waiver", matches: (c) => c.peEligible },
  { year: 10, semester: 1, label: "Health or waiver", matches: (c) => c.fulfillsRequirements.some((r) => canonicalRequirementName(r) === "Health") },
  { year: 10, semester: 2, label: "Physical Education, Applied Health, or Driver Education or waiver", matches: (c) => c.peEligible || isAppliedHealthCourse(c) },
  { year: 11, semester: 1, label: "Physical Education or waiver", matches: (c) => c.peEligible },
  { year: 11, semester: 2, label: "Physical Education or waiver", matches: (c) => c.peEligible },
  { year: 12, semester: 1, label: "Physical Education or waiver", matches: (c) => c.peEligible },
  { year: 12, semester: 2, label: "Physical Education or waiver", matches: (c) => c.peEligible },
];

function computePeSemesterBreakdown(placements: CoursePlacement[], resolutions: ResolutionInfo[]): PeSemesterBreakdown[] {
  const waivedYears = new Set<number>();
  for (const r of resolutions) {
    if (r.type === "pe_waiver") {
      const year = r.metadata?.year as number | undefined;
      if (year != null) waivedYears.add(year);
    }
  }
  const seen = new Set<string>();

  const breakdown: PeSemesterBreakdown[] = [];

  for (let i = 0; i < PE_SEMESTER_DEFS.length; i++) {
    const def = PE_SEMESTER_DEFS[i];

    const placement = placements.find((p) => {
      if (!p.course || p.year !== def.year || p.semester !== def.semester) return false;
      const key = `${p.year}-${p.semester}-${p.slot}`;
      if (seen.has(key)) return false;
      return def.matches(p.course as AnalysisCourse);
    });

    if (placement) {
      seen.add(`${placement.year}-${placement.semester}-${placement.slot}`);
    }

    breakdown.push({
      semester: i + 1,
      met: waivedYears.has(def.year) || placement != null,
      courseTitle: placement?.course?.title ?? null,
      courseId: placement?.course?.id ?? null,
      requiredLabel: def.label,
    });
  }

  return breakdown;
}

function computeDuplicateCourses(placements: CoursePlacement[]): DuplicateCourse[] {
  const byCourse = new Map<number, CoursePlacement[]>();
  for (const placement of placements) {
    if (!placement.course) continue;
    // Repeatable one-semester PE courses may be taken across semesters, so
    // legit repeats are not flagged as duplicates.
    if (
      placement.course.isRepeatable === true &&
      placement.course.duration === 1 &&
      placement.course.department === "Physical Education"
    ) {
      continue;
    }
    // Group matched summer courses with their regular equivalent so that taking
    // both counts as a duplicate attempt of the same course (unless retakeable).
    const groupId = placement.course.duplicateGroupId ?? placement.course.id;
    const list = byCourse.get(groupId) ?? [];
    list.push(placement);
    byCourse.set(groupId, list);
  }

  const duplicates: DuplicateCourse[] = [];
  for (const [courseId, list] of byCourse.entries()) {
    // Group by unique course placement (full-year course = 1 placement per year).
    const byPlacementKey = new Map<string, CoursePlacement[]>();
    for (const placement of list) {
      const key = getCourseKey(placement);
      if (!key) continue;
      const group = byPlacementKey.get(key) ?? [];
      group.push(placement);
      byPlacementKey.set(key, group);
    }
    if (byPlacementKey.size > 1) {
      const sortedGroups = Array.from(byPlacementKey.values()).sort((a, b) => {
        const firstA = a[0];
        const firstB = b[0];
        return firstA.year - firstB.year || firstA.semester - firstB.semester || firstA.slot - firstB.slot;
      });
      duplicates.push({
        courseId,
        title: sortedGroups[0][0].course!.title,
        count: sortedGroups.length,
        placements: sortedGroups.map((group) => {
          const first = group[0];
          const semesters = group.map((p) => p.semester).sort((a, b) => a - b);
          return { year: first.year, semester: semesters, slot: first.slot };
        }),
      });
    }
  }

  return duplicates;
}

function computeMissingPrerequisites(
  placements: CoursePlacement[],
  completedCourses: CompletedCourseWithCourse[],
  resolutions: ResolutionInfo[] = []
): MissingPrerequisite[] {
  const ordered: Array<{
    year: number;
    semester: number;
    title: string;
    courseCode: string | null;
    placement: CoursePlacement;
  }> = placements
    .filter((p) => p.course)
    .map((p) => ({
      year: p.year,
      semester: p.semester,
      title: p.course!.title,
      courseCode: p.course!.courseCode,
      placement: p,
    }));
  ordered.sort((a, b) => a.year - b.year || a.semester - b.semester);

  const completedItems = completedCourses.map((cc) => ({
    title: cc.course?.title ?? cc.summerCourse?.title ?? "",
    courseCode:
      cc.course?.options?.[0]?.offerings?.[0]?.courseCode ??
      cc.summerCourse?.courseCode ??
      "",
  }));

  // Build set of (courseId, prerequisite) that have been resolved via placement test
  const placementTestResolved = new Set<string>();
  for (const resolution of resolutions) {
    if (resolution.type === "placement_test" && resolution.courseId) {
      const prereq = resolution.metadata?.prerequisite as string | undefined;
      if (prereq) {
        placementTestResolved.add(`${resolution.courseId}:${normalizePrerequisite(prereq)}`);
      } else {
        // If no specific prerequisite, assume all prerequisites for the course are resolved
        placementTestResolved.add(`${resolution.courseId}:*`);
      }
    }
  }

  const missing: MissingPrerequisite[] = [];

  for (const { placement, year, semester } of ordered) {
    if (!placement.course) continue;
    const plannedIndex = ordered.findIndex(
      (item) => item.year === year && item.semester === semester && item.title === placement.course!.title
    );

    for (const prereq of placement.course.prerequisites) {
      if (!prereq.trim()) continue;

      // Check placement test resolutions
      const normalized = normalizePrerequisite(prereq);
      if (
        placementTestResolved.has(`${placement.course.id}:${normalized}`) ||
        placementTestResolved.has(`${placement.course.id}:*`)
      ) {
        continue;
      }

      const completed = completedItems.some((item) =>
        prerequisiteMatches(prereq, item)
      );
      if (completed) continue;

      const prereqIndex = ordered.findIndex((item) =>
        prerequisiteMatches(prereq, item)
      );

      if (prereqIndex === -1) {
        missing.push({
          plannedCourseId: placement.plannedCourseId,
          courseTitle: placement.course.title,
          year,
          semester,
          missingPrerequisite: prereq,
          reason: "notPlanned",
        });
      } else if (plannedIndex !== -1 && prereqIndex > plannedIndex) {
        missing.push({
          plannedCourseId: placement.plannedCourseId,
          courseTitle: placement.course.title,
          year,
          semester,
          missingPrerequisite: prereq,
          reason: "plannedLater",
        });
      }
    }
  }

  return missing;
}

function computePlannerStatistics(placements: CoursePlacement[]): PlannerStatistics {
  let studyHallCount = 0;
  let freePeriodCount = 0;
  const occupiedSlots = new Set<string>();
  const distinctCourses = new Set<string>();

  for (const placement of placements) {
    const slotKey = `${placement.year}-${placement.semester}-${placement.slot}`;
    occupiedSlots.add(slotKey);

    if (isStudyHall(placement.plannerOption)) {
      studyHallCount++;
    } else if (isFreePeriod(placement.plannerOption)) {
      freePeriodCount++;
    } else if (placement.course) {
      const key = getCourseKey(placement);
      if (key) distinctCourses.add(key);
    }
  }

  const totalSlots = YEARS.length * SEMESTERS_PER_YEAR * SLOTS_PER_SEMESTER;
  return {
    coursesScheduled: distinctCourses.size,
    freeSlotsRemaining: totalSlots - occupiedSlots.size,
    studyHallCount,
    freePeriodCount,
  };
}

async function loadResolutions(userId: number): Promise<ResolutionInfo[]> {
  const rows = await prisma.requirementResolution.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r: { id: number; type: string; courseId: number | null; metadata: unknown }) => ({
    id: r.id,
    type: r.type,
    courseId: r.courseId,
    metadata: r.metadata as Record<string, unknown>,
  }));
}

export async function analyzePlanners(userId: number): Promise<PlannerAnalysis> {
  const [placements, requirements, courseRequirementLinks, completedCourses, allCourses, resolutions, completedPlanners] =
    await Promise.all([
      loadPlacements(userId),
      loadGraduationRequirements(),
      loadCourseRequirementLinks(),
      loadCompletedCourses(userId),
      loadAllCourses(),
      loadResolutions(userId),
      prisma.planner.findMany({
        where: { userId, completedAt: { not: null } },
        select: { schoolYear: true },
      }),
    ]);

  // A completed planner year is settled: completing a year records its courses
  // as completed courses, so that year's planned placements must NOT also feed
  // graduation credits (otherwise they are double-counted). Incomplete years
  // keep using their planned placements (semester 1/2, summer, and online).
  // Year-level planner checks (course load, prerequisites, PE, statistics) still
  // operate on the full placements, because those are schedule concerns.
  const completedYears = new Set(completedPlanners.map((p) => p.schoolYear));
  const creditPlacements = placements.filter((p) => !completedYears.has(p.year));

  // Actual / earned view: only completed coursework. Completed-year placements
  // are intentionally excluded entirely (their courses are recorded as
  // CompletedCourse records), so passing an empty placements list guarantees
  // completed courses are never double-counted and planned future years are
  // never counted as "earned".
  const earnedRequirements = computeGraduationRequirements(requirements, courseRequirementLinks, [], completedCourses, resolutions);
  const earnedCredits = computeCredits([], completedCourses);

  const graduationRequirements = computeGraduationRequirements(requirements, courseRequirementLinks, creditPlacements, completedCourses, resolutions);

  const grCategoryChildren = new Map<string, Set<string>>();
  for (const req of requirements) {
    if (req.category) {
      if (!grCategoryChildren.has(req.category)) grCategoryChildren.set(req.category, new Set());
      grCategoryChildren.get(req.category)!.add(canonicalRequirementName(req.name));
    }
  }

  const mergedLinks = mergeCourseRequirementLinksByCanonicalRequirement(requirements, courseRequirementLinks);
  const recommendations = computeRecommendations(graduationRequirements, mergedLinks, creditPlacements, completedCourses, allCourses);
  for (const req of graduationRequirements) {
    const recs = recommendations.get(req.id);
    if (recs) {
      req.recommendedCourses = recs;
    }
  }

  return {
    credits: computeCredits(creditPlacements, completedCourses),
    earned: {
      credits: earnedCredits,
      graduationRequirements: earnedRequirements,
    },
    graduationRequirements,
    informationItems: toInformationItems(requirements),
    yearRequirements: computeYearRequirements(placements, grCategoryChildren),
    peSemesterBreakdown: computePeSemesterBreakdown(placements, resolutions),
    duplicateCourses: computeDuplicateCourses(placements),
    missingPrerequisites: computeMissingPrerequisites(placements, completedCourses, resolutions),
    plannerStatistics: computePlannerStatistics(placements),
    resolutions,
  };
}

export { YEAR_LABELS };

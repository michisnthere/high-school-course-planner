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
} from "@prisma/client";
import {
  canonicalRequirementName,
  normalizeRequirementNames,
  type InformationItem,
} from "./requirementsCleanup.js";
import { normalizePrerequisite } from "./prerequisiteNormalization.js";
import { deriveCourseDuration, calculateTotalCredits } from "./courseCredits.js";
import { GRADE_LEVEL_REQUIREMENTS } from "./gradeLevelRequirements.js";

type CourseOptionWithOfferings = CourseOption & { offerings: CourseOffering[] };
type CourseWithOptions = Course & {
  options: CourseOptionWithOfferings[];
  department?: { name: string; division?: { name: string } | null } | null;
};

type PlannedCourseWithRelations = PlannedCourse & {
  course: CourseWithOptions | null;
  plannerOption: PlannerOption | null;
  planner: Planner;
};

type CompletedCourseWithCourse = CompletedCourse & {
  course: CourseWithOptions;
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
  prerequisites: string[];
  peEligible: boolean;
  isFoundationalFitness: boolean;
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
    slotSpan: course.slotsPerSemester ?? 1,
    division: course.department?.division?.name ?? null,
    department: course.department?.name ?? null,
    fulfillsRequirements,
    prerequisites: Array.from(prerequisites),
    peEligible,
    isFoundationalFitness,
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
    return `${placement.year}-${placement.course.id}-${placement.slot}`;
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
          plannerOption: true,
        },
      },
    },
    orderBy: { schoolYear: "asc" },
  });

  const placements: CoursePlacement[] = [];
  for (const planner of planners) {
    for (const planned of planner.plannedCourses) {
      const course = planned.course ? toAnalysisCourse(planned.course) : null;
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

function getBackendPlacementKey(p: CoursePlacement): string {
  if (p.course?.duration === 2) {
    return `fy:${p.course.id}:${p.slot}`;
  }
  return `sem:${p.course!.id}:${p.slot}:${p.semester}`;
}

function computeCredits(placements: CoursePlacement[]) {
  let total = 0;
  const byRequirementCategory: Record<string, number> = {};
  const byDivision: Record<string, number> = {};
  const seen = new Set<string>();

  for (const placement of placements) {
    const course = placement.course;
    if (!course) continue;

    const key = getBackendPlacementKey(placement);
    if (seen.has(key)) continue;
    seen.add(key);

    total += placement.credits;

    for (const req of course.fulfillsRequirements) {
      byRequirementCategory[req] = (byRequirementCategory[req] ?? 0) + placement.credits;
    }

    const division = course.division ?? "Uncategorized";
    byDivision[division] = (byDivision[division] ?? 0) + placement.credits;
  }

  return { total, byRequirementCategory, byDivision };
}

function toInformationItems(requirements: GraduationRequirement[]): InformationItem[] {
  return requirements
    .filter((req) => !req.isMeasurable || req.requiredValue == null)
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
  resolutions: ResolutionInfo[] = []
): RequirementStatus[] {
  const courseIdToCredits = new Map<number, number>();
  const seen = new Set<string>();
  for (const placement of placements) {
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
    if (req.isMeasurable !== true) continue;
    const canonicalName = canonicalRequirementName(req.name);
    const existing = canonicalByName.get(canonicalName);
    if (!existing || (existing.requiredValue == null && req.requiredValue != null)) {
      canonicalByName.set(canonicalName, req);
    }
  }

  // Build courseId → fulfills canonical names
  const courseFulfillsMap = new Map<number, Set<string>>();
  for (const placement of placements) {
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

  const results = Array.from(canonicalByName.values()).map((req) => {
    const required = req.requiredValue ?? 0;
    let earned = 0;
    const canonicalName = canonicalRequirementName(req.name);
    const eligibleCourseIds = new Set<number>();
    for (const sourceReq of requirements) {
      if (canonicalRequirementName(sourceReq.name) !== canonicalName) continue;
      const links = courseRequirementLinks.get(sourceReq.id);
      if (!links) continue;
      for (const courseId of links) {
        eligibleCourseIds.add(courseId);
      }
    }
    for (const courseId of eligibleCourseIds) {
      const fulfills = courseFulfillsMap.get(courseId);
      if (fulfills && !fulfills.has(canonicalName)) continue;
      const credits = courseIdToCredits.get(courseId) ?? 0;
      if (credits > 0) {
        earned += credits;
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

  const completedCourseIds = new Set(completedCourses.map((cc) => cc.course.id));
  const completedItems = completedCourses.map((cc) => ({
    title: cc.course.title,
    courseCode: (cc.course.options?.[0]?.offerings?.[0]?.courseCode ?? "").toLowerCase(),
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
        const fulfillsCanonical = placement.course.fulfillsRequirements.map(canonicalRequirementName);
        if (!fulfillsCanonical.some((fr) => accepted.has(fr))) continue;
        const key = getBackendPlacementKey(placement);
        if (seen.has(key)) continue;
        seen.add(key);
        earnedCredits += placement.credits;
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

const PE_SEMESTER_DEFS: PeSemesterMatcher[] = [
  { year: 9, semester: 1, label: "Freshman Foundational Fitness or waiver", matches: (c) => c.isFoundationalFitness },
  { year: 9, semester: 2, label: "Physical Education or waiver", matches: (c) => c.peEligible },
  { year: 10, semester: 1, label: "Health or waiver", matches: (c) => c.fulfillsRequirements.some((r) => canonicalRequirementName(r) === "Health") },
  { year: 10, semester: 2, label: "Physical Education, Applied Health, or Driver Education or waiver", matches: (c) => c.peEligible },
  { year: 11, semester: 1, label: "Physical Education or waiver", matches: (c) => c.peEligible },
  { year: 11, semester: 2, label: "Physical Education or waiver", matches: (c) => c.peEligible },
  { year: 12, semester: 1, label: "Physical Education or waiver", matches: (c) => c.peEligible },
  { year: 12, semester: 2, label: "Physical Education or waiver", matches: (c) => c.peEligible },
];

function computePeSemesterBreakdown(placements: CoursePlacement[], resolutions: ResolutionInfo[]): PeSemesterBreakdown[] {
  const peWaived = resolutions.some((r) => r.type === "pe_waiver");
  const seen = new Set<string>();

  const breakdown: PeSemesterBreakdown[] = [];

  for (let i = 0; i < PE_SEMESTER_DEFS.length; i++) {
    const def = PE_SEMESTER_DEFS[i];

    const placement = placements.find((p) => {
      if (!p.course || p.year !== def.year || p.semester !== def.semester) return false;
      const key = getBackendPlacementKey(p);
      if (seen.has(key)) return false;
      return def.matches(p.course as AnalysisCourse);
    });

    if (placement) {
      seen.add(getBackendPlacementKey(placement));
    }

    breakdown.push({
      semester: i + 1,
      met: peWaived || placement != null,
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
    const list = byCourse.get(placement.course.id) ?? [];
    list.push(placement);
    byCourse.set(placement.course.id, list);
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
    title: cc.course.title,
    courseCode: cc.course.options?.[0]?.offerings?.[0]?.courseCode ?? "",
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
  const [placements, requirements, courseRequirementLinks, completedCourses, allCourses, resolutions] =
    await Promise.all([
      loadPlacements(userId),
      loadGraduationRequirements(),
      loadCourseRequirementLinks(),
      loadCompletedCourses(userId),
      loadAllCourses(),
      loadResolutions(userId),
    ]);

  const graduationRequirements = computeGraduationRequirements(requirements, courseRequirementLinks, placements, resolutions);

  const grCategoryChildren = new Map<string, Set<string>>();
  for (const req of requirements) {
    if (req.category) {
      if (!grCategoryChildren.has(req.category)) grCategoryChildren.set(req.category, new Set());
      grCategoryChildren.get(req.category)!.add(canonicalRequirementName(req.name));
    }
  }

  const mergedLinks = mergeCourseRequirementLinksByCanonicalRequirement(requirements, courseRequirementLinks);
  const recommendations = computeRecommendations(graduationRequirements, mergedLinks, placements, completedCourses, allCourses);
  for (const req of graduationRequirements) {
    const recs = recommendations.get(req.id);
    if (recs) {
      req.recommendedCourses = recs;
    }
  }

  return {
    credits: computeCredits(placements),
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

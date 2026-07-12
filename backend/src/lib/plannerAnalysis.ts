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
  isInformationItem,
  isMeasurableGraduationRequirement,
  normalizeRequirementNames,
  type InformationItem,
} from "./requirementsCleanup.js";

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
  division: string | null;
  department: string | null;
  fulfillsRequirements: string[];
  prerequisites: string[];
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

export type YearRequirementStatus = {
  grade: number;
  english: { required: boolean; met: boolean; earnedCredits: number };
  math: { required: boolean; met: boolean; earnedCredits: number };
  science: { required: boolean; met: boolean; earnedCredits: number };
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

export type PlannerAnalysis = {
  credits: {
    total: number;
    byRequirementCategory: Record<string, number>;
    byDivision: Record<string, number>;
  };
  graduationRequirements: RequirementStatus[];
  informationItems: InformationItem[];
  yearRequirements: YearRequirementStatus[];
  duplicateCourses: DuplicateCourse[];
  missingPrerequisites: MissingPrerequisite[];
  plannerStatistics: PlannerStatistics;
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

function deriveCourseDuration(course: CourseWithOptions): number {
  if (course.duration === 2) return 2;
  if (course.duration === 1) return 1;

  const hasFullYear = course.options.some((option) =>
    option.offerings?.some((offering) => {
      const value = offering.duration;
      if (typeof value === "number") return value === 2;
      if (typeof value === "string") return Number(value.trim()) === 2;
      return false;
    })
  );
  return hasFullYear ? 2 : 1;
}

function getCourseCredits(course: CourseWithOptions): number {
  const option = course.options[0];
  if (option?.credits != null) return option.credits;
  return deriveCourseDuration(course) / 2;
}

function toAnalysisCourse(course: CourseWithOptions): AnalysisCourse {
  const option = course.options[0];
  const rawPrereqs: unknown = option?.offerings?.[0]?.prerequisites;
  const prerequisites = new Set<string>();
  if (Array.isArray(rawPrereqs)) {
    for (const item of rawPrereqs) {
      if (typeof item === "string" && item.trim()) {
        prerequisites.add(item.trim());
      }
    }
  }

  const fulfillsRequirements = Array.isArray(course.fulfillsRequirements)
    ? normalizeRequirementNames(course.fulfillsRequirements.filter((r): r is string => typeof r === "string"))
    : [];

  const courseCode = option?.offerings?.[0]?.courseCode ?? null;

  return {
    id: course.id,
    title: course.title,
    courseCode,
    duration: deriveCourseDuration(course),
    credits: getCourseCredits(course),
    division: course.department?.division?.name ?? null,
    department: course.department?.name ?? null,
    fulfillsRequirements,
    prerequisites: Array.from(prerequisites),
  };
}

function isStudyHall(option: PlannerOption | null): boolean {
  return option?.name === "Study Hall";
}

function isFreePeriod(option: PlannerOption | null): boolean {
  return option?.name === "Free Period";
}

function isAcademicCourse(placement: CoursePlacement): boolean {
  return placement.course != null && !isStudyHall(placement.plannerOption) && !isFreePeriod(placement.plannerOption);
}

function courseMatchesCategory(course: AnalysisCourse, matches: string[]): boolean {
  const matchSet = new Set(matches.map((m) => m.toLowerCase()));
  return course.fulfillsRequirements.some((req) => matchSet.has(req.toLowerCase()));
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

function computeCredits(placements: CoursePlacement[]) {
  let total = 0;
  const byRequirementCategory: Record<string, number> = {};
  const byDivision: Record<string, number> = {};

  for (const placement of placements) {
    const course = placement.course;
    if (!course) continue;

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
    .filter((req) => isInformationItem(req))
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
  placements: CoursePlacement[]
): RequirementStatus[] {
  const courseIdToCredits = new Map<number, number>();
  for (const placement of placements) {
    if (!placement.course) continue;
    const existing = courseIdToCredits.get(placement.course.id) ?? 0;
    courseIdToCredits.set(placement.course.id, existing + placement.credits);
  }

  const canonicalByName = new Map<string, GraduationRequirement>();
  for (const req of requirements) {
    if (!isMeasurableGraduationRequirement(req)) continue;
    const canonicalName = canonicalRequirementName(req.name);
    const existing = canonicalByName.get(canonicalName);
    if (!existing || (existing.requiredValue == null && req.requiredValue != null)) {
      canonicalByName.set(canonicalName, req);
    }
  }

  return Array.from(canonicalByName.values()).map((req) => {
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
      earned += courseIdToCredits.get(courseId) ?? 0;
    }

    return {
      id: req.id,
      name: canonicalName,
      category: req.category,
      requirementType: req.requirementType,
      requiredValue: req.requiredValue,
      earnedValue: earned,
      remainingValue: Math.max(0, required - earned),
      status: getRequirementStatus(earned, required),
      recommendedCourses: [],
    };
  });
}

function mergeCourseRequirementLinksByCanonicalRequirement(
  requirements: GraduationRequirement[],
  courseRequirementLinks: Map<number, Set<number>>
): Map<number, Set<number>> {
  const canonicalIdByName = new Map<string, number>();
  for (const req of requirements) {
    if (!isMeasurableGraduationRequirement(req)) continue;
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
  item: { title: string; courseCode: string }
): boolean {
  const normalizedPrereq = prereq.toLowerCase();
  const normalizedTitle = item.title.toLowerCase();
  return (
    normalizedTitle.includes(normalizedPrereq) ||
    normalizedPrereq.includes(normalizedTitle) ||
    normalizedPrereq.includes(item.courseCode)
  );
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

const YEARLY_REQUIREMENTS: Record<number, Array<{ category: string; requiredCredits: number; matches: string[] }>> = {
  9: [
    { category: "Communication Arts", requiredCredits: 1, matches: ["English"] },
    { category: "Mathematics", requiredCredits: 1, matches: ["Mathematics"] },
    { category: "Science", requiredCredits: 1, matches: ["Biology", "Physical Science"] },
  ],
  10: [
    { category: "Communication Arts", requiredCredits: 1, matches: ["English"] },
    { category: "Mathematics", requiredCredits: 1, matches: ["Mathematics"] },
    { category: "Science", requiredCredits: 1, matches: ["Biology", "Physical Science"] },
  ],
  11: [
    { category: "Communication Arts", requiredCredits: 1, matches: ["English"] },
    { category: "Mathematics", requiredCredits: 1, matches: ["Mathematics"] },
  ],
  12: [{ category: "Communication Arts", requiredCredits: 1, matches: ["English"] }],
};

function computeYearRequirements(placements: CoursePlacement[]): YearRequirementStatus[] {
  return YEARS.map((grade) => {
    const reqs = YEARLY_REQUIREMENTS[grade] ?? [];
    const byCategory: Record<string, number> = {};

    for (const placement of placements) {
      if (placement.year !== grade || !placement.course) continue;
      for (const req of reqs) {
        if (courseMatchesCategory(placement.course, req.matches)) {
          byCategory[req.category] = (byCategory[req.category] ?? 0) + placement.credits;
        }
      }
    }

    const result: YearRequirementStatus = {
      grade,
      english: { required: false, met: false, earnedCredits: 0 },
      math: { required: false, met: false, earnedCredits: 0 },
      science: { required: false, met: false, earnedCredits: 0 },
    };

    for (const req of reqs) {
      const earned = byCategory[req.category] ?? 0;
      const met = earned >= req.requiredCredits;
      const entry = { required: true, met, earnedCredits: earned };
      if (req.category === "Communication Arts") {
        result.english = entry;
      } else if (req.category === "Mathematics") {
        result.math = entry;
      } else if (req.category === "Science") {
        result.science = entry;
      }
    }

    return result;
  });
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
  completedCourses: CompletedCourseWithCourse[]
): MissingPrerequisite[] {
  // Build an ordered timeline of all planned course placements.
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
    title: cc.course.title.toLowerCase(),
    courseCode: (cc.course.options?.[0]?.offerings?.[0]?.courseCode ?? "").toLowerCase(),
  }));

  const missing: MissingPrerequisite[] = [];

  for (const { placement, year, semester } of ordered) {
    if (!placement.course) continue;
    const plannedIndex = ordered.findIndex(
      (item) => item.year === year && item.semester === semester && item.title === placement.course!.title
    );

    for (const prereq of placement.course.prerequisites) {
      if (!prereq.trim()) continue;
      const normalizedPrereq = prereq.toLowerCase();

      const completed = completedItems.some(
        (item) =>
          item.title.includes(normalizedPrereq) ||
          normalizedPrereq.includes(item.title) ||
          normalizedPrereq.includes(item.courseCode)
      );
      if (completed) continue;

      const prereqIndex = ordered.findIndex((item) => {
        const normalizedTitle = item.title.toLowerCase();
        const courseCode = item.courseCode?.toLowerCase() ?? "";
        return (
          normalizedTitle.includes(normalizedPrereq) ||
          normalizedPrereq.includes(normalizedTitle) ||
          normalizedPrereq.includes(courseCode)
        );
      });

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

export async function analyzePlanners(userId: number): Promise<PlannerAnalysis> {
  const [placements, requirements, courseRequirementLinks, completedCourses, allCourses] = await Promise.all([
    loadPlacements(userId),
    loadGraduationRequirements(),
    loadCourseRequirementLinks(),
    loadCompletedCourses(userId),
    loadAllCourses(),
  ]);

  const graduationRequirements = computeGraduationRequirements(requirements, courseRequirementLinks, placements);

  return {
    credits: computeCredits(placements),
    graduationRequirements,
    informationItems: toInformationItems(requirements),
    yearRequirements: computeYearRequirements(placements),
    duplicateCourses: computeDuplicateCourses(placements),
    missingPrerequisites: computeMissingPrerequisites(placements, completedCourses),
    plannerStatistics: computePlannerStatistics(placements),
  };
}

export { YEAR_LABELS };

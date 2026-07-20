import type { Planner, PlannerCourseDetails, PlannedCourse } from "./planner";
import type { CompletedCourse } from "./completedCourses";
import type { RequirementResolution } from "./api";
import type { StudentPlanningData } from "./studentData";
import type { PlannerAnalysis, PeSemesterBreakdown } from "./plannerAnalysis";
import { calculateTotalCredits, deriveCourseDuration } from "./courseCredits";

const YEAR_LABELS: Record<number, string> = { 9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior" };
const SLOTS_PER_SEMESTER = 7;
const SEMESTERS_PER_YEAR = 2;
const YEARS = [9, 10, 11, 12] as const;

const REQUIREMENT_NAME_ALIASES = new Map<string, string>([
  ["english graduation requirement", "English"],
  ["mathematics graduation requirement", "Mathematics"],
  ["science graduation requirement", "Science"],
  ["social studies graduation requirement", "Social Studies"],
  ["civics and patriotism graduation requirements", "Civics & Patriotism"],
  ["civics and patriotism", "Civics & Patriotism"],
  ["driver education graduation requirement", "Driver Education"],
  ["elective graduation requirement", "Electives"],
  ["consumer education", "Economics or Personal Finance"],
  ["economics or personal finance graduation requirement", "Economics or Personal Finance"],
  ["economics or personal finance", "Economics or Personal Finance"],
  ["health graduation requirement", "Health"],
  ["physical welfare", "Physical Education"],
  ["physical welfare graduation requirement and waivers", "Physical Education"],
  ["the \"46th credit\" graduation requirement", "46th Credit"],
  ["fafsa graduation requirement", "FAFSA"],
  ["admission requirements to public universities in illinois", "Illinois Public University Admission Requirements"],
  ["ncaa eligibility requirements for division i and ii athletes", "NCAA"],
  ["schedule change guidelines", "Schedule Changes"],
]);

const INFORMATION_ITEM_NAMES = new Set([
  "Civics & Patriotism", "FAFSA", "NCAA", "Illinois Public University Admission Requirements",
  "Schedule Changes", "ACT Graduation Requirement", "ACT", "46th Credit",
  "Special Scheduling Provisions", "Suggested College Admission Sequence", "Course Load",
  "Independent Study", "Course Retake Policy", "Audits", "External Credits", "Summer School",
  "Early Graduation", "Grading", "Course Description", "Grade Point Average",
  "College Prep Courses", "Honors/Accelerated Courses", "Advanced Placement (AP) Courses",
  "Exclusions", "Grade Point Waiver", "Transfer Students", "Homework Requests", "Incomplete Grade",
]);

const MEASURABLE_REQUIREMENT_NAMES = new Set([
  "English", "Mathematics", "Science", "Biology", "Physical Science",
  "Health", "Economics or Personal Finance", "Driver Education", "Fine Arts",
  "Electives", "Physical Education", "Social Studies", "U.S. History",
  "World History and Geography", "Government", "Additional Credits and P.E.", "Total Credits",
]);

type GradeRequirementDefItem = { displayName: string; canonicalName: string; requiredCredits: number };
type GradeRequirementDef = { grade: number; items: GradeRequirementDefItem[] };

const GRADE_LEVEL_REQUIREMENTS: GradeRequirementDef[] = [
  { grade: 9,  items: [
    { displayName: "Communication Arts", canonicalName: "English", requiredCredits: 2 },
    { displayName: "Mathematics", canonicalName: "Mathematics", requiredCredits: 2 },
    { displayName: "Science", canonicalName: "Science", requiredCredits: 2 },
  ]},
  { grade: 10, items: [
    { displayName: "Communication Arts", canonicalName: "English", requiredCredits: 2 },
    { displayName: "Mathematics", canonicalName: "Mathematics", requiredCredits: 2 },
    { displayName: "Science", canonicalName: "Science", requiredCredits: 2 },
  ]},
  { grade: 11, items: [
    { displayName: "Communication Arts", canonicalName: "English", requiredCredits: 2 },
    { displayName: "Mathematics", canonicalName: "Mathematics", requiredCredits: 2 },
    { displayName: "U.S. History", canonicalName: "U.S. History", requiredCredits: 1 },
  ]},
  { grade: 12, items: [
    { displayName: "Communication Arts", canonicalName: "English", requiredCredits: 2 },
    { displayName: "Government", canonicalName: "Government", requiredCredits: 1 },
  ]},
];

type GraduationRequirementDef = {
  name: string; category: string | null; requirementType: string | null;
  requiredValue: number; isMeasurable: boolean;
};

const GRADUATION_REQUIREMENTS: GraduationRequirementDef[] = [
  { name: "English", category: null, requirementType: null, requiredValue: 8, isMeasurable: true },
  { name: "Mathematics", category: null, requirementType: null, requiredValue: 6, isMeasurable: true },
  { name: "Science", category: null, requirementType: null, requiredValue: 4, isMeasurable: true },
  { name: "Biology", category: "Science", requirementType: null, requiredValue: 2, isMeasurable: true },
  { name: "Physical Science", category: "Science", requirementType: null, requiredValue: 2, isMeasurable: true },
  { name: "Social Studies", category: null, requirementType: null, requiredValue: 4, isMeasurable: true },
  { name: "U.S. History", category: "Social Studies", requirementType: null, requiredValue: 2, isMeasurable: true },
  { name: "Government", category: "Social Studies", requirementType: null, requiredValue: 1, isMeasurable: true },
  { name: "World History and Geography", category: "Social Studies", requirementType: null, requiredValue: 2, isMeasurable: true },
  { name: "Physical Education", category: null, requirementType: null, requiredValue: 3.5, isMeasurable: true },
  { name: "Health", category: null, requirementType: null, requiredValue: 1, isMeasurable: true },
  { name: "Economics or Personal Finance", category: null, requirementType: null, requiredValue: 1, isMeasurable: true },
  { name: "Driver Education", category: null, requirementType: null, requiredValue: 1, isMeasurable: true },
  { name: "Fine Arts", category: null, requirementType: null, requiredValue: 1, isMeasurable: true },
  { name: "Electives", category: null, requirementType: null, requiredValue: 2, isMeasurable: true },
  { name: "Additional Credits and P.E.", category: null, requirementType: null, requiredValue: 17, isMeasurable: true },
  { name: "Total Credits", category: null, requirementType: null, requiredValue: 45, isMeasurable: true },
];

type AnalysisCourse = {
  id: number; title: string; courseCode: string | null; duration: number;
  credits: number; slotSpan: number; division: string | null; department: string | null;
  fulfillsRequirements: string[]; prerequisites: string[];
  peEligible: boolean; isFoundationalFitness: boolean;
};

type CoursePlacement = {
  plannedCourseId: number; year: number; semester: number; slot: number;
  course: AnalysisCourse | null; credits: number; isNonAcademic: boolean;
};

type StatusValue = "satisfied" | "partial" | "notStarted";
type RecommendedCourse = { courseId: number; title: string; reason: string };

type YearRequirementItem = {
  category: string; required: boolean; met: boolean;
  earnedCredits: number; requiredCredits: number; matches: string[];
};

type YearRequirementStatus = {
  grade: number; label: string; items: YearRequirementItem[];
  satisfiedCount: number; totalCount: number;
};

type DuplicateCourse = {
  courseId: number; title: string; count: number;
  placements: Array<{ year: number; semester: number[]; slot: number }>;
};

type MissingPrerequisite = {
  plannedCourseId: number; courseTitle: string; year: number; semester: number;
  missingPrerequisite: string; reason: "notPlanned" | "plannedLater";
};

type PlannerStatistics = {
  coursesScheduled: number; freeSlotsRemaining: number;
  studyHallCount: number; freePeriodCount: number;
};

type ResolutionInfo = { id: number; type: string; courseId: number | null; metadata: Record<string, unknown> };

function canonicalRequirementName(name: string): string {
  const trimmed = name.trim().toLowerCase().replace(/\s+/g, " ");
  return REQUIREMENT_NAME_ALIASES.get(trimmed) ?? name.trim();
}

function normalizeRequirementNames(names: string[] | undefined): string[] {
  const result = new Set<string>();
  for (const raw of Array.isArray(names) ? names : []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const canonical = canonicalRequirementName(raw);
    if (canonical === "Graduation Planner" || canonical === "Course Selection" ||
        canonical === "School Day Schedule" || canonical === "Course Availability") continue;
    if (INFORMATION_ITEM_NAMES.has(canonical)) continue;
    result.add(canonical);
  }
  return Array.from(result);
}

function normalizePrerequisite(prereq: string): string {
  const trimmed = prereq.trim().toLowerCase();
  if (trimmed === "any precalculus course" || trimmed === "any ap precalculus course") {
    return "AP Precalculus or Precalculus";
  }
  return prereq.trim();
}

function toAnalysisCourse(course: PlannerCourseDetails): AnalysisCourse {
  const fulfillsRequirements = normalizeRequirementNames(course.fulfillsRequirements);
  const fulfillsLower = fulfillsRequirements.map((r) => r.toLowerCase());
  return {
    id: course.id,
    title: course.title,
    courseCode: course.courseCode,
    duration: course.duration,
    credits: course.credits ?? 0,
    slotSpan: course.slotsPerSemester ?? 1,
    division: course.division,
    department: course.department,
    fulfillsRequirements,
    prerequisites: course.prerequisites,
    peEligible: fulfillsLower.some((r) => r === "physical education" || r === "driver education"),
    isFoundationalFitness: false,
  };
}

function getBackendPlacementKey(p: CoursePlacement): string {
  if (p.course?.duration === 2) return `fy:${p.course.id}:${p.slot}`;
  return `sem:${p.course!.id}:${p.slot}:${p.semester}`;
}

function getCourseKey(p: CoursePlacement): string | null {
  if (!p.course) return null;
  if (p.course.duration === 2) return `${p.year}-${p.course.id}`;
  return `${p.year}-${p.course.id}-${p.semester}-${p.slot}`;
}

function getRequirementStatus(earned: number, required: number): StatusValue {
  if (earned >= required) return "satisfied";
  if (earned > 0) return "partial";
  return "notStarted";
}

function buildPlacements(planners: Planner[], allCourses: PlannerCourseDetails[]): CoursePlacement[] {
  const courseMap = new Map<number, PlannerCourseDetails>();
  for (const c of allCourses) courseMap.set(c.id, c);

  const placements: CoursePlacement[] = [];
  for (const planner of planners) {
    for (const planned of planner.plannedCourses) {
      let course: AnalysisCourse | null = null;
      let credits = 0;
      let isNonAcademic = false;

      if (planned.courseId != null) {
        const raw = courseMap.get(planned.courseId) ?? planned.course;
        course = toAnalysisCourse(raw);
        credits = course.credits;
        isNonAcademic = raw.isNonAcademic;
      } else {
        isNonAcademic = planned.course.isNonAcademic;
        credits = planned.course.credits ?? 0;
      }

      placements.push({
        plannedCourseId: planned.id,
        year: planner.schoolYear,
        semester: planned.semester,
        slot: planned.slot,
        course,
        credits,
        isNonAcademic,
      });
    }
  }
  return placements;
}

function computeCredits(placements: CoursePlacement[]) {
  let total = 0;
  const byRequirementCategory: Record<string, number> = {};
  const byDivision: Record<string, number> = {};
  const seen = new Set<string>();

  for (const placement of placements) {
    if (!placement.course || placement.isNonAcademic) continue;
    const key = getBackendPlacementKey(placement);
    if (seen.has(key)) continue;
    seen.add(key);
    total += placement.credits;
    for (const req of placement.course.fulfillsRequirements) {
      byRequirementCategory[req] = (byRequirementCategory[req] ?? 0) + placement.credits;
    }
    const division = placement.course.division ?? "Uncategorized";
    byDivision[division] = (byDivision[division] ?? 0) + placement.credits;
  }
  return { total, byRequirementCategory, byDivision };
}

function computeGraduationRequirements(
  placements: CoursePlacement[],
  resolutions: ResolutionInfo[] = []
): PlannerAnalysis["graduationRequirements"] {
  const courseIdToCredits = new Map<number, number>();
  const seen = new Set<string>();
  for (const placement of placements) {
    if (!placement.course || placement.isNonAcademic) continue;
    const key = getBackendPlacementKey(placement);
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = courseIdToCredits.get(placement.course.id) ?? 0;
    courseIdToCredits.set(placement.course.id, existing + placement.credits);
  }

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

  const courseFulfillsMap = new Map<number, Set<string>>();
  for (const placement of placements) {
    if (!placement.course || placement.isNonAcademic) continue;
    if (!courseFulfillsMap.has(placement.course.id)) {
      courseFulfillsMap.set(placement.course.id, new Set());
    }
    for (const fr of placement.course.fulfillsRequirements) {
      courseFulfillsMap.get(placement.course.id)!.add(canonicalRequirementName(fr));
    }
  }

  let nextId = -1;
  return GRADUATION_REQUIREMENTS.filter((req) => req.isMeasurable && req.requiredValue > 0).map((req) => {
    const canonicalName = canonicalRequirementName(req.name);
    let earned = 0;
    for (const [courseId, fulfills] of courseFulfillsMap) {
      if (!fulfills.has(canonicalName)) continue;
      earned += courseIdToCredits.get(courseId) ?? 0;
    }

    let effectiveRequired = req.requiredValue;
    const hasPeWaiver = resolutions.some(
      (r) => r.type === "pe_waiver" && canonicalName === "Physical Education"
    );
    if (hasPeWaiver) effectiveRequired = 0;

    const id = nextId--;
    return {
      id,
      name: canonicalName,
      category: req.category,
      requirementType: req.requirementType,
      requiredValue: req.requiredValue,
      earnedValue: earned,
      remainingValue: Math.max(0, effectiveRequired - earned),
      status: getRequirementStatus(earned, effectiveRequired),
      recommendedCourses: [] as RecommendedCourse[],
    };
  });
}

const REQUIREMENT_CHILDREN: Record<string, string[]> = {
  "Science": ["Biology", "Physical Science"],
  "Social Studies": ["U.S. History", "World History and Geography", "Government"],
};

function computeYearRequirements(placements: CoursePlacement[]): YearRequirementStatus[] {
  const grCategoryChildren = new Map<string, Set<string>>();
  for (const gr of GRADUATION_REQUIREMENTS) {
    if (gr.category) {
      if (!grCategoryChildren.has(gr.category)) grCategoryChildren.set(gr.category, new Set());
      grCategoryChildren.get(gr.category)!.add(canonicalRequirementName(gr.name));
    }
  }

  return YEARS.map((grade) => {
    const gradeDef = GRADE_LEVEL_REQUIREMENTS.find((g) => g.grade === grade);
    const items: YearRequirementItem[] = (gradeDef?.items ?? []).map((item) => {
      const canonical = item.canonicalName;
      const accepted = new Set<string>([canonical]);
      const children = grCategoryChildren.get(canonical);
      if (children) for (const c of children) accepted.add(c);
      const hierarchyChildren = REQUIREMENT_CHILDREN[canonical];
      if (hierarchyChildren) for (const c of hierarchyChildren) accepted.add(c);

      let earnedCredits = 0;
      const seen = new Set<string>();
      for (const placement of placements) {
        if (placement.year !== grade || !placement.course || placement.isNonAcademic) continue;
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
    return { grade, label: YEAR_LABELS[grade], items, satisfiedCount, totalCount: items.length };
  });
}

type PeSemesterMatcher = {
  year: number; semester: number; label: string;
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
      return def.matches(p.course);
    });
    if (placement) seen.add(getBackendPlacementKey(placement));
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

function prerequisiteMatches(prereq: string, item: { title: string; courseCode?: string | null }): boolean {
  const normalized = normalizePrerequisite(prereq).toLowerCase();
  const normalizedTitle = item.title.toLowerCase();
  const normalizedCode = (item.courseCode ?? "").toLowerCase();
  const alternatives = normalized.split(/\s+or\s+/);
  for (const alt of alternatives) {
    const trimmed = alt.trim();
    if (!trimmed) continue;
    if (normalizedTitle.includes(trimmed) || trimmed.includes(normalizedTitle) || trimmed.includes(normalizedCode)) {
      return true;
    }
  }
  return false;
}

function computeMissingPrerequisites(
  placements: CoursePlacement[],
  completedCourses: CompletedCourse[],
  resolutions: ResolutionInfo[] = []
): MissingPrerequisite[] {
  const ordered = placements
    .filter((p) => p.course)
    .map((p) => ({ year: p.year, semester: p.semester, title: p.course!.title, courseCode: p.course!.courseCode, placement: p }));
  ordered.sort((a, b) => a.year - b.year || a.semester - b.semester);

  const completedItems = completedCourses.map((cc) => ({ title: cc.course.title, courseCode: cc.course.courseCode ?? "" }));

  const placementTestResolved = new Set<string>();
  for (const resolution of resolutions) {
    if (resolution.type === "placement_test" && resolution.courseId) {
      const prereq = resolution.metadata?.prerequisite as string | undefined;
      if (prereq) placementTestResolved.add(`${resolution.courseId}:${normalizePrerequisite(prereq)}`);
      else placementTestResolved.add(`${resolution.courseId}:*`);
    }
  }

  const missing: MissingPrerequisite[] = [];
  for (const { placement, year, semester } of ordered) {
    if (!placement.course) continue;
    const plannedIndex = ordered.findIndex((item) => item.year === year && item.semester === semester && item.title === placement.course!.title);
    for (const prereq of placement.course.prerequisites) {
      if (!prereq.trim()) continue;
      const normalized = normalizePrerequisite(prereq);
      if (placementTestResolved.has(`${placement.course.id}:${normalized}`) || placementTestResolved.has(`${placement.course.id}:*`)) continue;
      const completed = completedItems.some((item) => prerequisiteMatches(prereq, item));
      if (completed) continue;
      const prereqIndex = ordered.findIndex((item) => prerequisiteMatches(prereq, item));
      if (prereqIndex === -1) {
        missing.push({ plannedCourseId: placement.plannedCourseId, courseTitle: placement.course.title, year, semester, missingPrerequisite: prereq, reason: "notPlanned" });
      } else if (plannedIndex !== -1 && prereqIndex > plannedIndex) {
        missing.push({ plannedCourseId: placement.plannedCourseId, courseTitle: placement.course.title, year, semester, missingPrerequisite: prereq, reason: "plannedLater" });
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
    if (placement.isNonAcademic) {
      studyHallCount++;
    } else if (placement.course) {
      const key = getCourseKey(placement);
      if (key) distinctCourses.add(key);
    }
  }
  const totalSlots = YEARS.length * SEMESTERS_PER_YEAR * SLOTS_PER_SEMESTER;
  return { coursesScheduled: distinctCourses.size, freeSlotsRemaining: totalSlots - occupiedSlots.size, studyHallCount, freePeriodCount };
}

function computeRecommendations(
  graduationRequirements: PlannerAnalysis["graduationRequirements"],
  placements: CoursePlacement[],
  completedCourses: CompletedCourse[],
  allCourses: PlannerCourseDetails[]
): Map<number, RecommendedCourse[]> {
  const scheduledCourseIds = new Set<number>();
  const completedCourseIds = new Set(completedCourses.map((cc) => cc.course.id));

  for (const placement of placements) {
    if (placement.course) {
      scheduledCourseIds.add(placement.course.id);
    }
  }

  const completedItems = completedCourses.map((cc) => ({
    title: cc.course.title,
    courseCode: cc.course.courseCode ?? "",
  }));

  const plannedItems = placements
    .filter((p) => p.course)
    .map((p) => ({
      title: p.course!.title,
      courseCode: p.course!.courseCode ?? "",
    }));

  const recommendations = new Map<number, RecommendedCourse[]>();

  for (const req of graduationRequirements) {
    if (req.status === "satisfied") {
      recommendations.set(req.id, []);
      continue;
    }

    const list: Array<RecommendedCourse & { priority: number }> = [];

    for (const course of allCourses) {
      const fulfills = course.fulfillsRequirements.map(canonicalRequirementName);
      if (!fulfills.includes(req.name)) continue;
      if (completedCourseIds.has(course.id)) continue;
      if (scheduledCourseIds.has(course.id)) continue;

      const prereqs = course.prerequisites ?? [];
      let count = 0;
      let allCompleted = true;
      let anyPlanned = false;

      for (const prereq of prereqs) {
        if (!prereq.trim()) continue;
        count++;
        const completed = completedItems.some((item) => prerequisiteMatches(prereq, item));
        const planned = plannedItems.some((item) => prerequisiteMatches(prereq, item));
        if (!completed) allCompleted = false;
        if (planned) anyPlanned = true;
      }

      if (count > 0 && !allCompleted && !anyPlanned) continue;

      let reason: string;
      if (count === 0) {
        reason = "No prerequisites required";
      } else if (allCompleted) {
        reason = "Prerequisites met";
      } else if (anyPlanned) {
        reason = "Prerequisites planned";
      } else {
        reason = "Prerequisites met or planned";
      }

      const priority = allCompleted ? 0 : anyPlanned ? 1 : 2;
      list.push({ courseId: course.id, title: course.title, reason, priority });
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

export function computePlannerAnalysis(data: StudentPlanningData): PlannerAnalysis {
  const placements = buildPlacements(data.planners, data.allCourses);

  const graduationRequirements = computeGraduationRequirements(placements, data.resolutions);

  const recommendations = computeRecommendations(graduationRequirements, placements, data.completedCourses, data.allCourses);
  for (const req of graduationRequirements) {
    const recs = recommendations.get(req.id);
    if (recs) {
      req.recommendedCourses = recs;
    }
  }

  return {
    credits: computeCredits(placements),
    graduationRequirements,
    informationItems: [],
    yearRequirements: computeYearRequirements(placements),
    peSemesterBreakdown: computePeSemesterBreakdown(placements, data.resolutions),
    duplicateCourses: computeDuplicateCourses(placements),
    missingPrerequisites: computeMissingPrerequisites(placements, data.completedCourses, data.resolutions),
    plannerStatistics: computePlannerStatistics(placements),
    resolutions: data.resolutions.map((r) => ({ id: r.id, type: r.type, courseId: r.courseId, metadata: r.metadata })),
  };
}

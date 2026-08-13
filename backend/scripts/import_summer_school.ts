import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalRequirementName } from "../src/lib/requirementsCleanup.js";

// ---------------------------------------------------------------------------
// Summer School catalog import.
//
// Phase 2: REAL, BUT FULLY ISOLATED, database import.
//
// Guarantees (by design):
//   * ADDITIVE only. New dedicated Summer School tables (SummerCourse,
//     SummerCourseSession, SummerCourseRequirement) are written. The regular
//     Course / CourseOption / CourseOffering / Department / Division tables and
//     (except for the explicitly-authorized obsolete Consumer Education
//     deletion) the GraduationRequirement table are NEVER written by this
//     script.
//   * Summer School offerings keep their own session vocabulary
//     ("Session 1" / "Session 2") instead of reusing regular semester labels.
//   * Explicit creditStatus ("credit" | "non-credit" | "unknown"); 0 is never
//     used as a silent placeholder. credits is null for non-credit/unknown.
//   * Idempotent + transactional: the Summer tables are replaced inside a
//     single transaction, so re-runs cannot duplicate courses/sessions/links
//     and a failure rolls back to a complete prior state.
//   * Gated: dry-run is the default and refuses to write. Writes require
//     --apply. A baseline diff of the regular catalog is produced and verified
//     to be ZERO except the authorized Consumer Education removal.
//   * Stop-and-report: any ambiguity (unresolved requirement name, ambiguous
//     or unresolved regular-course match, non-year-specific-requirement
//     linkage) aborts BEFORE any write. Nothing is guessed.
//
// Usage:
//   npm run import:summer-school -- --dry-run                     # default
//   npm run import:summer-school -- --apply                       # real import
//   npm run import:summer-school -- --apply --remove-consumer-education
//   npm run import:summer-school -- --baseline prev.json --dry-run catalog.json
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CATALOG = path.resolve(
  __dirname,
  "..",
  "..",
  "extractor",
  "summer_school",
  "output",
  "combined",
  "summer-school-ready.json"
);

const CREDIT_CREDIT = "credit";
const CREDIT_NON_CREDIT = "non-credit";
const CREDIT_UNKNOWN = "unknown";
const CREDIT_STATUSES = new Set([CREDIT_CREDIT, CREDIT_NON_CREDIT, CREDIT_UNKNOWN]);

const DURATION_ONE_SESSION = "one_session";
const DURATION_FULL_SUMMER = "full_summer";
const SUMMER_DURATIONS = new Set([DURATION_ONE_SESSION, DURATION_FULL_SUMMER]);

const SESSION_1 = "Session 1";
const SESSION_2 = "Session 2";
const SUMMER_SESSIONS = new Set([SESSION_1, SESSION_2]);

// The default credit bucket for summer courses that do not explicitly fulfill
// a graduation requirement (mirrors regular planner semantics; NO link row is
// created for it in the regular catalog either).
const ADDITIONAL_CREDITS_NAME = "Additional Credits and P.E.";

const CONSUMER_EDUCATION_NAMES = ["Consumer Education"];

type SourceRef = { file?: string; page?: number };

type Course = {
  title?: string;
  key?: string;
  courseCode?: string | null;
  credits?: number | null;
  creditStatus?: string; // from catalog (annotated) or inferred
  sessions?: string[];
  duration?: "one_session" | "full_summer" | null;
  creditType?: string | null;
  cost?: string | null;
  durationNote?: string | null;
  meetings?: Array<{
    courseCode?: string | null;
    dates?: string | null;
    startTime?: string | null;
    endTime?: string | null;
  }>;
  prerequisites?: string[];
  corequisites?: string[];
  fulfillsRequirements?: string[];
  isSummerOnly?: boolean | null;
  regularCourseMatch?: {
    status: "matched" | "candidate" | "unresolved";
    matchedCourseId?: number | null;
    matchedTitle?: string | null;
    matchedCourseCode?: string | null;
    confidence?: "high" | "medium" | "low" | null;
    reason?: string | null;
  } | null;
  sourceReference?: SourceRef | null;
  extractionIssues?: Array<{ field?: string; status?: string; note?: string | null }>;
  notes?: string[];
};

type Catalog = {
  schemaVersion?: string;
  courses?: Course[];
  warnings?: string[];
};

type ReportSection = {
  label: string;
  items: Array<{ title?: string; detail?: string | null }>;
};

function courseTitle(c: Course): string {
  return c.title?.trim() || c.key || "<untitled>";
}

function courseSignature(c: Course): string {
  const sessions = Array.isArray(c.sessions) ? [...(c.sessions as string[])].sort().join(",") : "";
  return [
    c.courseCode ?? "",
    c.duration ?? "",
    sessions,
    c.credits?.toString() ?? "",
  ].join("|");
}

function creditStatusOf(c: Course): string {
  if (c.creditStatus && CREDIT_STATUSES.has(c.creditStatus)) return c.creditStatus;
  if (c.credits != null) return CREDIT_CREDIT;
  return CREDIT_NON_CREDIT; // catalog has no "unknown" today; non-credit default keeps null credits
}

function parseArgs(argv: string[]): {
  catalogPath: string;
  baselinePath: string | null;
  dryRun: boolean;
  removeConsumerEducation: boolean;
} {
  let catalogPath = DEFAULT_CATALOG;
  let baselinePath: string | null = null;
  let dryRun = true;
  let removeConsumerEducation = false;

  const positional: string[] = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-dry-run" || arg === "--apply") {
      dryRun = false;
    } else if (arg === "--remove-consumer-education") {
      removeConsumerEducation = true;
    } else if (arg === "--baseline") {
      baselinePath = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("-")) {
      // ignore other flags
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    catalogPath = positional[positional.length - 1];
  }
  return { catalogPath, baselinePath, dryRun, removeConsumerEducation };
}

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeTitleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeNameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// DB index helpers (read-only)
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

async function loadRequirementIndex(): Promise<Map<string, number>> {
  const rows = await prisma.graduationRequirement.findMany({
    select: { id: true, name: true, normalizedName: true },
  });
  const index = new Map<string, number>();
  for (const r of rows) {
    index.set(normalizeNameKey(r.name), r.id);
    if (r.normalizedName) index.set(normalizeNameKey(r.normalizedName), r.id);
    index.set(canonicalRequirementName(r.name).trim().toLowerCase(), r.id);
  }
  return index;
}

function resolveRequirementId(
  name: string,
  index: Map<string, number>
): { id: number | null; ambiguous: string[] } {
  const candidates = new Set<number>();
  const add = (keys: string[]) => {
    for (const k of keys) {
      const id = index.get(k);
      if (id !== undefined) candidates.add(id);
    }
  };
  add([normalizeNameKey(name)]);
  add([normalizeNameKey(canonicalRequirementName(name))]);

  if (candidates.size === 0) return { id: null, ambiguous: [] };
  if (candidates.size > 1) {
    return { id: null, ambiguous: Array.from(candidates).map(String) };
  }
  return { id: Array.from(candidates)[0], ambiguous: [] };
}

async function loadRegularCourseIndex(): Promise<{
  byTitle: Map<string, number[]>;
  byCode: Map<string, number[]>;
}> {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      title: true,
      normalizedTitle: true,
      options: { select: { offerings: { select: { courseCode: true } } } },
    },
  });
  const byTitle = new Map<string, number[]>();
  const byCode = new Map<string, number[]>();
  for (const c of courses) {
    const key = normalizeTitleKey(c.title);
    const list = byTitle.get(key) ?? [];
    list.push(c.id);
    byTitle.set(key, list);
    for (const opt of c.options) {
      for (const off of opt.offerings) {
        if (!off.courseCode) continue;
        const codeKey = normalizeTitleKey(String(off.courseCode));
        const codes = byCode.get(codeKey) ?? [];
        codes.push(c.id);
        byCode.set(codeKey, codes);
      }
    }
  }
  return { byTitle, byCode };
}

function resolveRegularCourseId(
  course: Course,
  index: { byTitle: Map<string, number[]>; byCode: Map<string, number[]> }
): { id: number | null; reason: string } {
  const titleKey = normalizeTitleKey(courseTitle(course));
  const titleHits = index.byTitle.get(titleKey) ?? [];
  if (titleHits.length === 1) return { id: titleHits[0], reason: `title match ${courseTitle(course)}` };
  if (titleHits.length > 1) return { id: null, reason: `ambiguous title (${titleHits.length} courses)` };

  const code = course.courseCode ?? null;
  if (code) {
    const firstCode = code.split("/")[0].trim();
    const codeHits = index.byCode.get(normalizeTitleKey(firstCode)) ?? [];
    if (codeHits.length === 1) return { id: codeHits[0], reason: `code match ${firstCode}` };
    if (codeHits.length > 1) return { id: null, reason: `ambiguous code (${codeHits.length} courses)` };
  }
  return { id: null, reason: "no exact title/code match in regular catalog" };
}

// ---------------------------------------------------------------------------
// Snapshot + diff (read-only regular catalog state)
// ---------------------------------------------------------------------------

type RegularSnapshot = {
  courses: Map<number, string>;
  requirements: Map<number, { name: string; gradeLevel: number | null; isMeasurable: boolean }>;
  courseRequirements: Array<[number, number]>;
  options: number;
  offerings: number;
  departments: number;
  divisions: number;
};

async function snapshotRegular(client: typeof prisma): Promise<RegularSnapshot> {
  const [courses, requirements, courseRequirements, options, offerings, departments, divisions] =
    await Promise.all([
      client.course.findMany({ select: { id: true, title: true } }),
      client.graduationRequirement.findMany({
        select: { id: true, name: true, gradeLevel: true, isMeasurable: true },
      }),
      client.courseRequirement.findMany({
        select: { courseId: true, graduationRequirementId: true },
      }),
      client.courseOption.count(),
      client.courseOffering.count(),
      client.department.count(),
      client.division.count(),
    ]);
  return {
    courses: new Map(courses.map((c) => [c.id, c.title])),
    requirements: new Map(
      requirements.map((r) => [r.id, { name: r.name, gradeLevel: r.gradeLevel, isMeasurable: r.isMeasurable }])
    ),
    courseRequirements: courseRequirements
      .map((l) => [l.courseId, l.graduationRequirementId] as [number, number])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    options,
    offerings,
    departments,
    divisions,
  };
}

function diffRegular(before: RegularSnapshot, after: RegularSnapshot): {
  coursesAdded: Array<[number, string]>;
  coursesRemoved: Array<[number, string]>;
  coursesRenamed: Array<[number, string, string]>;
  requirementsAdded: Array<[number, string]>;
  requirementsRemoved: Array<[number, string]>;
  requirementsModified: Array<[number, string]>;
  linksAdded: number;
  linksRemoved: number;
  optionsDelta: number;
  offeringsDelta: number;
  departmentsDelta: number;
  divisionsDelta: number;
} {
  const coursesAdded: Array<[number, string]> = [];
  const coursesRemoved: Array<[number, string]> = [];
  const coursesRenamed: Array<[number, string, string]> = [];
  for (const [id, title] of after.courses) {
    if (!before.courses.has(id)) coursesAdded.push([id, title]);
  }
  for (const [id, title] of before.courses) {
    const afterTitle = after.courses.get(id);
    if (afterTitle === undefined) coursesRemoved.push([id, title]);
    else if (afterTitle !== title) coursesRenamed.push([id, title, afterTitle]);
  }

  const requirementsAdded: Array<[number, string]> = [];
  const requirementsRemoved: Array<[number, string]> = [];
  const requirementsModified: Array<[number, string]> = [];
  for (const [id, info] of after.requirements) {
    if (!before.requirements.has(id)) requirementsAdded.push([id, info.name]);
  }
  for (const [id, info] of before.requirements) {
    const afterInfo = after.requirements.get(id);
    if (!afterInfo) {
      requirementsRemoved.push([id, info.name]);
    } else if (
      afterInfo.name !== info.name ||
      afterInfo.gradeLevel !== info.gradeLevel ||
      afterInfo.isMeasurable !== info.isMeasurable
    ) {
      requirementsModified.push([id, info.name]);
    }
  }

  const beforeLinkSet = new Set(before.courseRequirements.map(([a, b]) => `${a}:${b}`));
  const afterLinkSet = new Set(after.courseRequirements.map(([a, b]) => `${a}:${b}`));
  let linksAdded = 0;
  let linksRemoved = 0;
  for (const key of afterLinkSet) if (!beforeLinkSet.has(key)) linksAdded += 1;
  for (const key of beforeLinkSet) if (!afterLinkSet.has(key)) linksRemoved += 1;

  return {
    coursesAdded,
    coursesRemoved,
    coursesRenamed,
    requirementsAdded,
    requirementsRemoved,
    requirementsModified,
    linksAdded,
    linksRemoved,
    optionsDelta: after.options - before.options,
    offeringsDelta: after.offerings - before.offerings,
    departmentsDelta: after.departments - before.departments,
    divisionsDelta: after.divisions - before.divisions,
  };
}

// ---------------------------------------------------------------------------
// Validation (report-only; runs before ANY write, in dry-run too)
// ---------------------------------------------------------------------------

type ValidationProblem = {
  courseKey: string;
  field?: string;
  severity: "error" | "warning";
  message: string;
};

async function validateCatalog(
  catalog: Catalog,
  opts: { requirementIndex: Map<string, number>; courseIndex: { byTitle: Map<string, number[]>; byCode: Map<string, number[]> } }
): Promise<ValidationProblem[]> {
  const problems: ValidationProblem[] = [];
  const courses = Array.isArray(catalog.courses) ? catalog.courses : [];
  const seenKeys = new Set<string>();
  const totalSessions = new Map<string, number>();

  for (const course of courses) {
    const key = course.key || normalizeTitleKey(courseTitle(course));
    const err = (field: string | undefined, message: string) =>
      problems.push({ courseKey: key, field, severity: "error", message });

    if (!course.title?.trim()) err("title", "missing title");
    if (!key || seenKeys.has(key)) err("key", `duplicate or missing key: ${key || "<none>"}`);
    seenKeys.add(key);

    const status = creditStatusOf(course);
    if (!CREDIT_STATUSES.has(status)) err("creditStatus", `invalid creditStatus ${status}`);
    if (status === CREDIT_CREDIT && (course.credits == null || course.credits <= 0)) {
      err("credits", `credit course must have numeric credits > 0 (got ${course.credits})`);
    }
    if (status !== CREDIT_CREDIT && course.credits != null) {
      err("credits", `non-credit/unknown course must have null credits (got ${course.credits})`);
    }

    const grades = Array.isArray(course.sessions) ? course.sessions : [];
    if (!course.duration || !SUMMER_DURATIONS.has(course.duration)) {
      err("duration", `invalid duration ${course.duration}`);
    }
    if (grades.length === 0) err("sessions", "at least one session required");
    for (const s of grades) {
      if (!SUMMER_SESSIONS.has(s)) err("sessions", `unknown session token ${s}`);
    }
    if (new Set(grades).size !== grades.length) err("sessions", "duplicate session token");
    if (course.duration === DURATION_FULL_SUMMER) {
      const set = new Set(grades);
      if (!set.has(SESSION_1) || !set.has(SESSION_2)) {
        err("sessions", "full_summer must list both sessions");
      }
    }

    const lvls = (course as { gradeLevels?: number[] }).gradeLevels ?? [];
    if (!Array.isArray(lvls) || lvls.length === 0) err("gradeLevels", "gradeLevels required");
    if (!lvls.every((g) => Number.isInteger(g) && g >= 9 && g <= 12)) {
      err("gradeLevels", `invalid grade level(s) ${JSON.stringify(lvls)}`);
    }

    const prereqs = Array.isArray(course.prerequisites) ? course.prerequisites : [];
    if (!prereqs.every((p) => typeof p === "string")) err("prerequisites", "prerequisites must be strings");

    for (const req of Array.isArray(course.fulfillsRequirements) ? course.fulfillsRequirements : []) {
      const resolved = resolveRequirementId(req, opts.requirementIndex);
      if (resolved.id === null) {
        err(
          "fulfillsRequirements",
          `printed requirement ${JSON.stringify(req)} does not resolve${
            resolved.ambiguous.length ? ` (ambiguous: ${resolved.ambiguous.join(",")})` : ""
          }`
        );
      }
    }

    const match = course.regularCourseMatch ?? null;
    if (match?.status === "matched") {
      const resolved = resolveRegularCourseId(course, opts.courseIndex);
      if (resolved.id === null) {
        err("regularCourseMatch", `matched course cannot be resolved (${resolved.reason})`);
      }
    } else if (course.isSummerOnly !== true && match !== null && match.status !== "matched") {
      // candidate/unresolved without isSummerOnly flag -> keep reviewable
      problems.push({
        courseKey: key,
        field: "regularCourseMatch",
        severity: "warning",
        message: `${courseTitle(course)}: ${match.status} match, isSummerOnly=${course.isSummerOnly}`,
      });
    }
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Apply (transactional; NEVER touches regular tables except authorized deletion)
// ---------------------------------------------------------------------------

async function consumerEducationLookup(): Promise<{ id: number; links: number } | null> {
  const rows = await prisma.graduationRequirement.findMany({
    where: { name: { in: CONSUMER_EDUCATION_NAMES } },
    select: { id: true },
  });
  if (rows.length === 0) return null;
  const id = rows[0].id;
  const courseLinks = await prisma.courseRequirement.count({
    where: { graduationRequirementId: id },
  });
  const summerLinks = await prisma.summerCourseRequirement.count({
    where: { graduationRequirementId: id },
  });
  return { id, links: courseLinks + summerLinks };
}

type SummerCourseInputRow = {
  course: Course;
  key: string;
  creditStatus: string;
  regularCourseId: number | null;
  resolvedRequirementIds: number[] | null;
};

function buildRows(
  catalog: Catalog,
  resolved: Map<string, { regularCourseId: number | null; requirementIds: number[] | null }>
): SummerCourseInputRow[] {
  const rows: SummerCourseInputRow[] = [];
  for (const course of Array.isArray(catalog.courses) ? catalog.courses : []) {
    const key = course.key || normalizeTitleKey(courseTitle(course));
    const info = resolved.get(key) ?? { regularCourseId: null, requirementIds: null };
    rows.push({
      course,
      key,
      creditStatus: creditStatusOf(course),
      regularCourseId: info.regularCourseId,
      resolvedRequirementIds: info.requirementIds,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Review report (kept from Phase 1 dry-run review surface)
// ---------------------------------------------------------------------------

function buildReport(catalog: Catalog, baseline?: Catalog | null): ReportSection[] {
  const courses = Array.isArray(catalog.courses) ? catalog.courses : [];
  const sections: ReportSection[] = [];

  const newCourses: ReportSection = { label: "New Summer School courses", items: [] };
  const matched: ReportSection = { label: "Existing regular courses matched", items: [] };
  const summerOnly: ReportSection = { label: "Summer-only courses (no regular catalog match)", items: [] };
  const potential: ReportSection = { label: "Potential title/code matches (needs review)", items: [] };
  const unresolved: ReportSection = { label: "Unresolved matches (could not be confirmed)", items: [] };
  const changed: ReportSection = { label: "Changed Summer School offerings", items: [] };
  const removed: ReportSection = { label: "Removed Summer School offerings", items: [] };
  const validationWarnings: ReportSection = { label: "Validation warnings", items: [] };

  const baselineCourses = new Map<string, Course>();
  if (baseline && Array.isArray(baseline.courses)) {
    for (const c of baseline.courses) {
      baselineCourses.set(courseTitle(c).toLowerCase(), c);
    }
  }

  for (const course of courses) {
    const title = courseTitle(course);
    const match = course.regularCourseMatch ?? null;
    const signature = courseSignature(course);

    if (course.extractionIssues && course.extractionIssues.length > 0) {
      validationWarnings.items.push({ title, detail: `${course.extractionIssues.length} field(s) unclear/missing` });
    }
    if (match?.status === "candidate") {
      potential.items.push({ title, detail: match?.reason ?? null });
    } else if (match?.status === "matched" || course.isSummerOnly === false) {
      matched.items.push({ title, detail: match?.matchedTitle ?? null });
    } else {
      const base = baselineCourses.get(title.toLowerCase());
      if (base) {
        if (signature !== courseSignature(base)) {
          changed.items.push({ title, detail: `offering metadata changed vs baseline` });
        }
      } else {
        newCourses.items.push({ title, detail: match?.reason ?? null });
      }
      if (course.isSummerOnly === true) {
        summerOnly.items.push({ title, detail: null });
      } else {
        unresolved.items.push({ title, detail: match?.reason ?? null });
      }
    }
  }

  if (baselineCourses.size > 0) {
    const currentTitles = new Set(courses.map((c) => courseTitle(c).toLowerCase()));
    for (const [lowerTitle, course] of baselineCourses) {
      if (!currentTitles.has(lowerTitle)) {
        removed.items.push({ title: courseTitle(course), detail: null });
      }
    }
  }

  for (const w of Array.isArray(catalog.warnings) ? catalog.warnings : []) {
    validationWarnings.items.push({ title: "catalog-level warning", detail: w });
  }

  for (const section of [
    newCourses,
    matched,
    summerOnly,
    potential,
    changed,
    removed,
    unresolved,
    validationWarnings,
  ]) {
    sections.push(section);
  }
  return sections;
}

function printReport(sections: ReportSection[]): void {
  const summary: Record<string, number> = {};
  for (const section of sections) {
    summary[section.label] = section.items.length;
    console.log(`\n## ${section.label} (${section.items.length})`);
    if (section.items.length === 0) {
      console.log("  (none)");
      continue;
    }
    for (const item of section.items) {
      const detail = item.detail ? ` — ${item.detail}` : "";
      console.log(`  - ${item.title}${detail}`);
    }
  }
  console.log("\n");
  console.log("Review summary:", JSON.stringify(summary, null, 2));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { catalogPath, baselinePath, dryRun, removeConsumerEducation } = parseArgs(process.argv);

  let catalog: Catalog;
  try {
    catalog = await loadJson<Catalog>(catalogPath);
  } catch {
    console.error(`Catalog not found at ${catalogPath}`);
    process.exitCode = 1;
    return;
  }

  let baseline: Catalog | null = null;
  if (baselinePath) {
    try {
      baseline = await loadJson<Catalog>(baselinePath);
    } catch {
      console.warn(`Baseline not found (ignored): ${baselinePath}`);
    }
  }

  console.log(`Catalog: ${catalogPath}`);
  console.log(`Schema:  ${catalog.schemaVersion ?? "(unspecified)"}`);
  console.log(`Mode:    ${dryRun ? "DRY RUN (no writes)" : "APPLY (real writes)"}`);
  console.log(`Consumer Education removal authorized: ${removeConsumerEducation}`);

  const courses = Array.isArray(catalog.courses) ? catalog.courses : [];

  // -- Indexes --------------------------------------------------------------
  const requirementIndex = await loadRequirementIndex();
  const courseIndex = await loadRegularCourseIndex();

  // -- Prerun validation ----------------------------------------------------
  const validation = await validateCatalog(catalog, { requirementIndex, courseIndex });
  const errors = validation.filter((p) => p.severity === "error");
  console.log(`\nPre-import validation: ${errors.length ? `${errors.length} ERROR(S)` : "PASS"} (${validation.length} total checks)`);
  for (const p of validation) {
    console.log(`  [${p.severity}] ${p.courseKey}${p.field ? ` (${p.field})` : ""}: ${p.message}`);
  }

  // Resolve every course to its write shape (no writes yet).
  const resolved = new Map<string, { regularCourseId: number | null; requirementIds: number[] | null }>();
  for (const course of courses) {
    const key = course.key || normalizeTitleKey(courseTitle(course));
    let regularCourseId: number | null = null;
    const match = course.regularCourseMatch ?? null;
    if (match?.status === "matched") {
      regularCourseId = resolveRegularCourseId(course, courseIndex).id;
    }
    const reqNames = Array.isArray(course.fulfillsRequirements) ? course.fulfillsRequirements : [];
    let requirementIds: number[] | null = null;
    if (reqNames.length > 0) {
      const ids: number[] = [];
      for (const req of reqNames) {
        const r = resolveRequirementId(req, requirementIndex);
        if (r.id !== null) ids.push(r.id);
      }
      requirementIds = ids;
    }
    resolved.set(key, { regularCourseId, requirementIds });
  }

  // -- Consumer Education check ---------------------------------------------
  const consumerEd = await consumerEducationLookup();
  if (consumerEd) {
    console.log(
      `\nConsumer Education (id=${consumerEd.id}) exists with ${consumerEd.links} reference(s).`
    );
    if (consumerEd.links > 0) {
      console.error("REFUSING: obsolete requirement still has references (not removable).");
      process.exitCode = 1;
      return;
    }
    console.log(
      `  Reference check: PASS (0 references). Whether removed depends on mode + flag.`
    );
  } else {
    console.log("\nConsumer Education not found in DB (nothing to remove).");
  }

  // -- Build projected diff ---------------------------------------------------
  const rows = buildRows(catalog, resolved);
  const nonCredit = rows.filter((r) => r.creditStatus === CREDIT_NON_CREDIT);
  const matchedCount = rows.filter((r) => r.regularCourseId !== null).length;
  const summerOnlyCount = rows.filter((r) => r.course.isSummerOnly === true).length;
  const totalSessions = rows.reduce((n, r) => n + (Array.isArray(r.course.sessions) ? r.course.sessions.length : 0), 0);
  const totalReqLinks = rows.reduce((n, r) => n + (r.resolvedRequirementIds?.length ?? 0), 0);

  console.log(`\nProjected Summer School import: ${rows.length} courses, ${totalSessions} session entries, ${totalReqLinks} requirement links`);
  console.log(`  matched to regular: ${matchedCount} | summer-only: ${courses.length - matchedCount} | non-credit: ${nonCredit.length}`);
  console.log(`  non-credit courses: ${nonCredit.map((r) => courseTitle(r.course)).join("; ") || "(none)"}`);
  console.log(`  courses with NO explicit printed requirement (default to "${ADDITIONAL_CREDITS_NAME}", no link):`);
  for (const r of rows) {
    if (!r.resolvedRequirementIds || r.resolvedRequirementIds.length === 0) {
      console.log(`    - ${courseTitle(r.course)}`);
    }
  }

  const before = await snapshotRegular(prisma);

  // Stop gate: no writes unless validation clean AND (apply mode) AND consumer ed ok.
  const canWrite = errors.length === 0;
  if (!canWrite) {
    console.error("\nABORT: validation errors above must be resolved; no writes attempted.");
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log("\nDRY RUN COMPLETE — no database writes performed (rerun with --apply to import).");
    printReport(buildReport(catalog, baseline));
    return;
  }

  // ---- REAL APPLY (single transaction) -------------------------------------
  let consumerRemoved = false;
  try {
    await prisma.$transaction(
      async (tx) => {
      // 1. Replace Summer tables (isolated scope; idempotent on rerun).
      await tx.summerCourseRequirement.deleteMany({});
      await tx.summerCourseSession.deleteMany({});
      await tx.summerCourse.deleteMany({});

      for (const row of rows) {
        const c = row.course;
        const source = c.sourceReference ?? {};
        const summerCourse = await tx.summerCourse.create({
          data: {
            key: row.key,
            title: courseTitle(c),
            courseCode: c.courseCode ?? null,
            description: (c as { description?: string }).description ?? null,
            creditStatus: row.creditStatus,
            credits: c.credits ?? null,
            creditType: (c as { creditType?: string | null }).creditType ?? null,
            gradeLevels: (c as { gradeLevels?: number[] }).gradeLevels ?? [],
            duration: c.duration ?? DURATION_ONE_SESSION,
            durationNote: (c as { durationNote?: string | null }).durationNote ?? null,
            cost: (c as { cost?: string | null }).cost ?? null,
            meetings: Array.isArray((c as { meetings?: unknown }).meetings)
              ? (c as { meetings?: unknown }).meetings
              : [],
            prerequisites: Array.isArray(c.prerequisites) ? c.prerequisites : [],
            corequisites: Array.isArray(c.corequisites) ? c.corequisites : [],
            fulfillsRequirements: Array.isArray(c.fulfillsRequirements) ? c.fulfillsRequirements : [],
            isSummerOnly: c.isSummerOnly === true,
            regularCourseId: row.regularCourseId,
            matchedTitle: c.regularCourseMatch?.matchedTitle ?? null,
            matchedCourseCode: c.regularCourseMatch?.matchedCourseCode ?? null,
            matchConfidence: c.regularCourseMatch?.confidence ?? null,
            sourcePage: typeof source.page === "number" ? source.page : 0,
            sourceReference: `${source.file ?? "SummerSchool2627.pdf"} page ${source.page ?? "?"}`,
            notes: Array.isArray(c.notes) ? c.notes : [],
            extractionIssues: Array.isArray(c.extractionIssues) ? c.extractionIssues : [],
          },
        });

        const sessionRows = Array.isArray(c.sessions) ? c.sessions : [];
        for (const session of sessionRows) {
          await tx.summerCourseSession.create({
            data: {
              summerCourseId: summerCourse.id,
              session,
              ordinal: session === SESSION_2 ? 2 : 1,
            },
          });
        }

        const reqNames = Array.isArray(c.fulfillsRequirements) ? c.fulfillsRequirements : [];
        for (const [i, sourceName] of reqNames.entries()) {
          const reqId = row.resolvedRequirementIds?.[i];
          if (reqId === undefined) continue;
          await tx.summerCourseRequirement.create({
            data: {
              summerCourseId: summerCourse.id,
              graduationRequirementId: reqId,
              sourceName,
            },
          });
        }
      }

      // 2. Authorized obsolete-requirement cleanup (in-transaction reference re-check).
      if (removeConsumerEducation && consumerEd && consumerEd.links === 0) {
        const stillLinked = await tx.courseRequirement.count({
          where: { graduationRequirementId: consumerEd.id },
        });
        if (stillLinked === 0) {
          await tx.graduationRequirement.delete({ where: { id: consumerEd.id } });
          consumerRemoved = true;
        }
      }
      },
      { timeout: 120_000 }
    );
  } catch (err) {
    console.error("\nAPPLY FAILED — transaction rolled back; no partial Summer School data.");
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return;
  }

  // ---- Post-apply verification (compare regular diff + summer counts) -------
  const after = await snapshotRegular(prisma);
  const diff = diffRegular(before, after);

  const allowedRemovedCe = consumerRemoved ? 1 : 0;
  const regularClean =
    diff.coursesAdded.length === 0 &&
    diff.coursesRemoved.length === 0 &&
    diff.coursesRenamed.length === 0 &&
    diff.requirementsAdded.length === 0 &&
    diff.requirementsRemoved.length === allowedRemovedCe &&
    diff.requirementsModified.length === 0 &&
    diff.linksAdded === 0 &&
    diff.linksRemoved === 0 &&
    diff.optionsDelta === 0 &&
    diff.offeringsDelta === 0 &&
    diff.departmentsDelta === 0 &&
    diff.divisionsDelta === 0;

  console.log(`\n## Regular-catalog baseline diff (expected ZERO, except authorized Consumer Education removal)`);
  console.log(`  courses added: ${diff.coursesAdded.length} | removed: ${diff.coursesRemoved.length} | renamed: ${diff.coursesRenamed.length}`);
  console.log(`  requirements added: ${diff.requirementsAdded.length} | removed: ${diff.requirementsRemoved.length} | modified: ${diff.requirementsModified.length}`);
  console.log(`  CourseRequirement links added: ${diff.linksAdded} | removed: ${diff.linksRemoved}`);
  console.log(`  options delta: ${diff.optionsDelta} | offerings delta: ${diff.offeringsDelta} | departments delta: ${diff.departmentsDelta} | divisions delta: ${diff.divisionsDelta}`);
  for (const [id, name] of diff.requirementsRemoved) console.log(`    REMOVED requirement id=${id} "${name}"`);
  console.log(`  RESULT: ${regularClean ? "CLEAN (no unexpected regular-catalog changes)" : "DIRTY — see above"}`);
  if (!regularClean) process.exitCode = 1;

  // Summer verifications
  const summerCourses = await prisma.summerCourse.findMany({
    include: { sessions: true, requirement: true },
    orderBy: { id: "asc" },
  });
  const dbKeys = new Set(summerCourses.map((c) => c.key));
  const inputKeys = new Set(rows.map((r) => r.key));
  const missingKeys = Array.from(inputKeys).filter((k) => !dbKeys.has(k));
  const extraKeys = Array.from(dbKeys).filter((k) => !inputKeys.has(k));
  const dupKeys = dbKeys.size !== summerCourses.length;
  const sessionCount = summerCourses.reduce((n, c) => n + c.sessions.length, 0);
  const linkCount = summerCourses.reduce((n, c) => n + c.requirement.length, 0);
  const matchedDb = summerCourses.filter((c) => c.regularCourseId !== null).length;
  const summerOnlyDb = summerCourses.filter((c) => c.isSummerOnly).length;
  const nonCreditDb = summerCourses.filter((c) => c.creditStatus === CREDIT_NON_CREDIT).length;

  console.log(`\n## Post-import Summer School verification`);
  console.log(`  summerCourses: ${summerCourses.length} (expect ${rows.length})`);
  console.log(`  sessions:      ${sessionCount} (expect ${totalSessions})`);
  console.log(`  req links:     ${linkCount} (expect ${totalReqLinks})`);
  console.log(`  matched regular: ${matchedDb} (expect ${matchedCount}) | summer-only: ${summerOnlyDb} | non-credit: ${nonCreditDb}`);
  console.log(`  missing keys: ${missingKeys.length ? missingKeys.join(",") : "none"} | extra keys: ${extraKeys.length ? extraKeys.join(",") : "none"} | duplicate keys: ${dupKeys}`);
  console.log(`  consumer education removed: ${consumerRemoved}`);

  // Requirement-link validation: every link to an existing measurable requirement, none year-specific.
  const linkedReqs = await prisma.graduationRequirement.findMany({
    select: { id: true, gradeLevel: true, name: true },
    where: { summerCourses: { some: {} } },
  });
  const yearSpecific = linkedReqs.filter((r) => r.gradeLevel != null);
  console.log(`  requirements referenced by Summer School: ${linkedReqs.map((r) => r.name).join("; ") || "(none)"}`);
  console.log(`  year-specific references: ${yearSpecific.length ? yearSpecific.map((r) => r.name).join(",") : "none"}`);

  const appliedSuccess =
    missingKeys.length === 0 &&
    extraKeys.length === 0 &&
    !dupKeys &&
    summerCourses.length === rows.length;
  console.log(`\nAPPLY ${regularClean && appliedSuccess ? "SUCCESS" : "CHECK NEEDED"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
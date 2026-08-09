import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Summer School catalog dry-run import.
//
// Phase 1: FRAMEWORK ONLY. This script exists so the extraction output can be
// reviewed through the same import surface the project uses for the regular
// catalog (`npm run import:courses` -> `scripts/import_courses.ts`), but it
// performs NO database writes. Every run is a dry run by default.
//
// Usage:
//   npm run import:summer-school -- --dry-run [path/to/summer-ready.json]
//   npm run import:summer-school -- --dry-run --baseline prev.json catalog.json
//
// The "-" in `npm run ... -- --dry-run` forwards the flags after `--`.
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

type SourceRef = { file?: string; page?: number };

type Course = {
  title?: string;
  key?: string;
  courseCode?: string | null;
  credits?: number | null;
  sessions?: string[];
  duration?: "one_session" | "full_summer" | null;
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
  extractionIssues?: unknown[];
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

function parseArgs(argv: string[]): { catalogPath: string; baselinePath: string | null; dryRun: boolean } {
  let catalogPath = DEFAULT_CATALOG;
  let baselinePath: string | null = null;
  let dryRun = true;

  const positional: string[] = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-dry-run" || arg === "--apply") {
      dryRun = false;
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
  return { catalogPath, baselinePath, dryRun };
}

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

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

  // Removed relative to baseline.
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
  console.log("Dry-run summary:", JSON.stringify(summary, null, 2));
}

async function main(): Promise<void> {
  const { catalogPath, baselinePath, dryRun } = parseArgs(process.argv);

  if (!dryRun) {
    console.error(
      "Refusing to run: the Summer School concrete import (real database writes) is Phase 2. " +
        "This script currently supports dry-run only."
    );
    process.exitCode = 1;
    return;
  }

  let catalog: Catalog;
  try {
    catalog = await loadJson<Catalog>(catalogPath);
  } catch {
    console.error(`Catalog not found at ${catalogPath}`);
    console.error("Run the extraction pipeline first, or pass a path to the ready catalog.");
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
  console.log(`Baseline:${baselinePath ? ` ${baselinePath}` : " none (no diff possible)"}`);

  const sections = buildReport(catalog, baseline);
  printReport(sections);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
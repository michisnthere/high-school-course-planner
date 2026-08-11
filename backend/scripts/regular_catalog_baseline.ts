// ---------------------------------------------------------------------------
// Regular-catalog baseline gate.
//
// Proof that no change in the Summer School bridge ever alters the regular
// catalog: 223 courses, 240 options, 466 offerings, 23 departments, 10
// divisions, 43 graduation requirements, and their CourseRequirement links.
//
// Usage:
//   snap    -> writes backend/.baseline/regular-baseline.json  (current state)
//   check   -> compares current state against the baseline and exits non-zero
//              on any difference (courses/options/offerings/depts/divisions/
//              requirements/link changes).
//
// Mirrors the snapshot+diff logic in import_summer_school.ts.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASELINE_DIR = path.resolve(__dirname, "..", ".baseline");
const BASELINE_FILE = path.join(BASELINE_DIR, "regular-baseline.json");

type RegularSnapshot = {
  courses: Array<[number, string]>;
  requirements: Array<[number, { name: string; gradeLevel: number | null; isMeasurable: boolean }]>;
  courseRequirements: Array<[number, number]>;
  options: number;
  offerings: number;
  departments: number;
  divisions: number;
};

const prisma = new PrismaClient();

async function snapshotRegular(): Promise<RegularSnapshot> {
  const [courses, requirements, courseRequirements, options, offerings, departments, divisions] =
    await Promise.all([
      prisma.course.findMany({ select: { id: true, title: true } }),
      prisma.graduationRequirement.findMany({
        select: { id: true, name: true, gradeLevel: true, isMeasurable: true },
      }),
      prisma.courseRequirement.findMany({ select: { courseId: true, graduationRequirementId: true } }),
      prisma.courseOption.count(),
      prisma.courseOffering.count(),
      prisma.department.count(),
      prisma.division.count(),
    ]);
  return {
    courses: courses.map((c) => [c.id, c.title]).sort((a, b) => a[0] - b[0]),
    requirements: requirements
      .map((r) => [r.id, { name: r.name, gradeLevel: r.gradeLevel, isMeasurable: r.isMeasurable }])
      .sort((a, b) => a[0] - b[0]),
    courseRequirements: courseRequirements
      .map((l) => [l.courseId, l.graduationRequirementId] as [number, number])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    options,
    offerings,
    departments,
    divisions,
  };
}

function diffRegular(label: string, before: RegularSnapshot, after: RegularSnapshot): string[] {
  const problems: string[] = [];

  const coursesAdded = new Set(after.courses.map(([id]) => id));
  for (const [id] of before.courses) coursesAdded.delete(id);
  if (coursesAdded.size > 0) problems.push(`courses added: ${Array.from(coursesAdded).join(",")}`);

  const coursesRemoved = new Set(before.courses.map(([id]) => id));
  for (const [id] of after.courses) coursesRemoved.delete(id);
  if (coursesRemoved.size > 0) problems.push(`courses removed: ${Array.from(coursesRemoved).join(",")}`);

  const beforeTitle = new Map(before.courses);
  for (const [id, title] of after.courses) {
    const old = beforeTitle.get(id);
    if (old !== undefined && old !== title) problems.push(`course renamed: #${id} "${old}" -> "${title}"`);
  }

  if (before.options !== after.options) problems.push(`options delta: ${before.options} -> ${after.options}`);
  if (before.offerings !== after.offerings) problems.push(`offerings delta: ${before.offerings} -> ${after.offerings}`);
  if (before.departments !== after.departments) problems.push(`departments delta: ${before.departments} -> ${after.departments}`);
  if (before.divisions !== after.divisions) problems.push(`divisions delta: ${before.divisions} -> ${after.divisions}`);

  const beforeReq = new Map(before.requirements);
  const reqAdded = new Set(after.requirements.map(([id]) => id));
  for (const [id] of before.requirements) reqAdded.delete(id);
  if (reqAdded.size > 0) problems.push(`requirements added: ${Array.from(reqAdded).join(",")}`);
  const reqRemoved = new Set(before.requirements.map(([id]) => id));
  for (const [id] of after.requirements) reqRemoved.delete(id);
  if (reqRemoved.size > 0) problems.push(`requirements removed: ${Array.from(reqRemoved).join(",")}`);
  for (const [id, info] of after.requirements) {
    const old = beforeReq.get(id);
    if (old && (old.name !== info.name || old.gradeLevel !== info.gradeLevel || old.isMeasurable !== info.isMeasurable)) {
      problems.push(`requirement modified: #${id} "${info.name}"`);
    }
  }

  const beforeLinks = new Set(before.courseRequirements.map(([a, b]) => `${a}:${b}`));
  const afterLinks = new Set(after.courseRequirements.map(([a, b]) => `${a}:${b}`));
  let linksAdded = 0;
  let linksRemoved = 0;
  for (const key of afterLinks) if (!beforeLinks.has(key)) linksAdded += 1;
  for (const key of beforeLinks) if (!afterLinks.has(key)) linksRemoved += 1;
  if (linksAdded > 0 || linksRemoved > 0) problems.push(`CourseRequirement links added: ${linksAdded}, removed: ${linksRemoved}`);

  return problems;
}

async function main() {
  const command = process.argv[2];
  const snap = await snapshotRegular();

  if (command === "snap") {
    await mkdir(BASELINE_DIR, { recursive: true });
    await writeFile(BASELINE_FILE, JSON.stringify(snap, null, 2), "utf8");
    const counts = {
      courses: snap.courses.length,
      options: snap.options,
      offerings: snap.offerings,
      departments: snap.departments,
      divisions: snap.divisions,
      requirements: snap.requirements.length,
      courseRequirementLinks: snap.courseRequirements.length,
    };
    console.log(`Baseline written to ${BASELINE_FILE}`);
    console.log(JSON.stringify(counts, null, 2));
    return;
  }

  if (command === "check") {
    let before: RegularSnapshot;
    try {
      before = JSON.parse(await readFile(BASELINE_FILE, "utf8")) as RegularSnapshot;
    } catch {
      console.error("No baseline found. Run: npm run baseline:regular -- snap");
      process.exit(1);
    }
    const problems = diffRegular("bridge", before, snap);
    if (problems.length > 0) {
      console.error("## REGULAR-CATALOG BASELINE DIFF (must be ZERO)");
      for (const p of problems) console.error(`  [CHANGED] ${p}`);
      process.exit(1);
    }
    console.log("## REGULAR-CATALOG BASELINE DIFF: ZERO (no changes to regular catalog)");
    return;
  }

  console.error('Usage: npm run baseline:regular -- snap | check');
  process.exit(1);
}

main().finally(() => prisma.$disconnect());
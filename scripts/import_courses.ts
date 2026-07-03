import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeDepartment, parseSemester, parseDurationUnits } from "./lib/normalize";

// ---------------------------------------------------------------------------
// Input types — subdepartment is optional; not all source records carry it.
// ---------------------------------------------------------------------------

type CourseOfferingInput = {
  courseCode?: string | null;
  semesterLabel?: string | null;
  duration?: string | null;
  gradeLevels?: number[];
  prerequisites?: string[];
  corequisites?: string[];
  creditType?: string | null;
  credits?: number | null;
};

type CourseInput = {
  title?: string;
  department?: string | null;
  subdepartment?: string | null;
  description?: string | null;
  gpaWaiverOption?: boolean;
  isOnline?: boolean;
  offerings?: CourseOfferingInput[];
  notes?: string[];
  sourceReference?: string | null;
};

type ExtractedCatalog = {
  courses?: CourseInput[];
};

type FailedRecord = {
  title?: string;
  sourceReference?: string | null;
  importKey?: string;
  reason: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INPUT_PATH = path.resolve("data", "extracted_courses.json");

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// In-memory caches  (department name → id,  "deptId:subdeptName" → id)
// ---------------------------------------------------------------------------

const departmentCache = new Map<string, number>();
const subdepartmentCache = new Map<string, number>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireArray<T>(value: T[] | undefined, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}

function importKeyFor(course: CourseInput): string {
  return `${course.sourceReference ?? ""}::${course.title}`;
}

// ---------------------------------------------------------------------------
// Pre-write validation (rule 7)
//
// Runs BEFORE any DB writes. Ensures:
//   - required fields exist on every course/offering
//   - no duplicate importKeys across the whole input
//   - no duplicate courseCodes across the whole input
// First occurrence wins; every subsequent collision is logged to
// failedRecords and the whole course record is skipped (never partially
// imported, never silently overwritten).
// ---------------------------------------------------------------------------

function validateAll(
  courses: CourseInput[]
): { valid: CourseInput[]; failedRecords: FailedRecord[] } {
  const seenImportKeys = new Set<string>();
  const seenCourseCodes = new Set<string>();
  const valid: CourseInput[] = [];
  const failedRecords: FailedRecord[] = [];

  for (const course of courses) {
    const importKey = importKeyFor(course);

    const fail = (reason: string) => {
      failedRecords.push({
        title: course.title,
        sourceReference: course.sourceReference,
        importKey,
        reason,
      });
    };

    if (!course.title?.trim()) {
      fail("missing title");
      continue;
    }
    if (!Array.isArray(course.offerings) || course.offerings.length === 0) {
      fail("missing offerings");
      continue;
    }
    if (seenImportKeys.has(importKey)) {
      fail(`duplicate importKey in input: ${importKey}`);
      continue;
    }

    let offeringConflict: string | null = null;
    for (const offering of course.offerings) {
      if (!offering.courseCode?.trim()) {
        offeringConflict = `missing courseCode for "${course.title}"`;
        break;
      }
      if (seenCourseCodes.has(offering.courseCode)) {
        offeringConflict = `duplicate courseCode in input: ${offering.courseCode}`;
        break;
      }
    }
    if (offeringConflict) {
      fail(offeringConflict);
      continue;
    }

    // Record is clean — commit its keys so later duplicates are caught.
    seenImportKeys.add(importKey);
    for (const offering of course.offerings) {
      seenCourseCodes.add(offering.courseCode!);
    }
    valid.push(course);
  }

  return { valid, failedRecords };
}

// ---------------------------------------------------------------------------
// Department  — upsert once, cache forever
// ---------------------------------------------------------------------------

async function getOrCreateDepartment(name: string): Promise<number> {
  const cached = departmentCache.get(name);
  if (cached !== undefined) return cached;

  const dept = await prisma.department.upsert({
    where: { name },
    create: { name },
    update: {},
    select: { id: true },
  });

  departmentCache.set(name, dept.id);
  return dept.id;
}

// ---------------------------------------------------------------------------
// Subdepartment  — upsert once per (departmentId, name), cache forever
// ---------------------------------------------------------------------------

async function getOrCreateSubdepartment(
  departmentId: number,
  name: string
): Promise<number> {
  const cacheKey = `${departmentId}:${name}`;
  const cached = subdepartmentCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const subdept = await prisma.subdepartment.upsert({
    where: { departmentId_name: { departmentId, name } },
    create: { name, departmentId },
    update: {},
    select: { id: true },
  });

  subdepartmentCache.set(cacheKey, subdept.id);
  return subdept.id;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const raw = await readFile(INPUT_PATH, "utf8");
  const catalog = JSON.parse(raw) as ExtractedCatalog;
  const allCourses = Array.isArray(catalog.courses) ? catalog.courses : [];

  const { valid: courses, failedRecords } = validateAll(allCourses);

  let coursesUpserted = 0;
  let offeringsUpserted = 0;
  let coursesWithNoDepartment = 0;
  let coursesWithNoSubdepartment = 0;

  for (const course of courses) {
    // -- Department + Subdepartment --------------------------------------
    //
    // department_raw / subdepartment come from normalizeDepartment(), which
    // splits compound raw strings (e.g. "Applied Arts–Business Education")
    // and maps every known raw value onto the standardized department list.
    // No fake subdepartments (e.g. "General") are created: when the course
    // has a real department but no distinct subdepartment, subdepartmentId
    // is left null exactly as the normalization produced it — see the
    // schema-alignment note in the final summary for the trade-off this
    // implies given the current schema's Course → Subdepartment → Department
    // linkage.
    const norm = normalizeDepartment(course.department);

    let subdepartmentId: number | null = null;

    if (norm.department) {
      const departmentId = await getOrCreateDepartment(norm.department);

      if (norm.subdepartment) {
        subdepartmentId = await getOrCreateSubdepartment(departmentId, norm.subdepartment);
      } else {
        coursesWithNoSubdepartment += 1;
      }
    } else {
      coursesWithNoDepartment += 1;
    }

    // -- Course  — upsert by importKey only ------------------------------
    const importKey = importKeyFor(course);

    let savedCourse: { id: number };
    try {
      savedCourse = await prisma.course.upsert({
        where: { importKey },
        create: {
          title: course.title!,
          importKey,
          description: course.description ?? null,
          gpaWaiverOption: Boolean(course.gpaWaiverOption),
          isOnline: Boolean(course.isOnline),
          notes: requireArray(course.notes),
          sourceReference: course.sourceReference ?? null,
          subdepartmentId,
        },
        update: {
          description: course.description ?? null,
          gpaWaiverOption: Boolean(course.gpaWaiverOption),
          isOnline: Boolean(course.isOnline),
          notes: requireArray(course.notes),
          subdepartmentId,
        },
        select: { id: true },
      });
    } catch (err: unknown) {
      // A P2002 on (subdepartmentId, title) means a different record with
      // the same title already occupies this subdepartment slot. This is a
      // data quality conflict, not something to merge or overwrite — log it
      // and move on so the run stays clean.
      const isPrismaUniqueViolation =
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002";

      if (isPrismaUniqueViolation) {
        failedRecords.push({
          title: course.title,
          sourceReference: course.sourceReference,
          importKey,
          reason: "title already exists under this subdepartment (conflicting course, not overwritten)",
        });
        continue;
      }
      throw err;
    }
    coursesUpserted += 1;

    // -- Offerings  — upsert by courseCode only --------------------------
    // semester (INT) and durationUnits (FLOAT, supports 1.0/1.5/2.0) are
    // computed here from the raw semesterLabel/duration text. The current
    // Prisma schema does not have dedicated Int/Float columns for these
    // (see summary — schema alignment note), so the parsed canonical values
    // are stored back into the existing semesterLabel/duration String
    // columns, replacing inconsistent raw text ("SEMESTER 1", "Semester 1
    // Only", etc.) with a single normalized representation.
    for (const offering of course.offerings!) {
      const semester = parseSemester(offering.semesterLabel);
      const durationUnits = parseDurationUnits(offering.duration);

      await prisma.courseOffering.upsert({
        where: { courseCode: offering.courseCode! },
        create: {
          courseCode: offering.courseCode!,
          semesterLabel: semester !== null ? String(semester) : offering.semesterLabel ?? null,
          duration: durationUnits !== null ? String(durationUnits) : offering.duration ?? null,
          gradeLevels: requireArray(offering.gradeLevels),
          prerequisites: requireArray(offering.prerequisites),
          corequisites: requireArray(offering.corequisites),
          creditType: offering.creditType ?? null,
          credits: offering.credits ?? null,
          courseId: savedCourse.id,
        },
        update: {
          semesterLabel: semester !== null ? String(semester) : offering.semesterLabel ?? null,
          duration: durationUnits !== null ? String(durationUnits) : offering.duration ?? null,
          gradeLevels: requireArray(offering.gradeLevels),
          prerequisites: requireArray(offering.prerequisites),
          corequisites: requireArray(offering.corequisites),
          creditType: offering.creditType ?? null,
          credits: offering.credits ?? null,
          courseId: savedCourse.id,
        },
      });
      offeringsUpserted += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        inputPath: INPUT_PATH,
        totalCoursesInFile: allCourses.length,
        coursesUpserted,
        offeringsUpserted,
        departmentsCached: departmentCache.size,
        subdepartmentsCached: subdepartmentCache.size,
        coursesWithNoDepartment,
        coursesWithNoSubdepartment,
        failedRecords,
      },
      null,
      2
    )
  );

  if (failedRecords.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

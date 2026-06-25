import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
  reason: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INPUT_PATH = path.resolve("data", "extracted_courses.json");
const FALLBACK_SUBDEPARTMENT = "General";

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

function validateCourse(course: CourseInput, seenCodes: Set<string>): string | null {
  if (!course.title?.trim()) {
    return "missing title";
  }
  if (!Array.isArray(course.offerings) || course.offerings.length === 0) {
    return "missing offerings";
  }
  for (const offering of course.offerings) {
    if (!offering.courseCode?.trim()) {
      return `missing courseCode for "${course.title}"`;
    }
    if (seenCodes.has(offering.courseCode)) {
      return `duplicate courseCode in input: ${offering.courseCode}`;
    }
    seenCodes.add(offering.courseCode);
  }
  return null;
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
  const courses = Array.isArray(catalog.courses) ? catalog.courses : [];

  const seenCodes = new Set<string>();
  const failedRecords: FailedRecord[] = [];

  let coursesUpserted = 0;
  let offeringsUpserted = 0;
  let noDepartment = 0;

  for (const course of courses) {
    // -- Validate --------------------------------------------------------
    const validationError = validateCourse(course, seenCodes);
    if (validationError) {
      failedRecords.push({
        title: course.title,
        sourceReference: course.sourceReference,
        reason: validationError,
      });
      continue;
    }

    // -- Department + Subdepartment --------------------------------------
    //
    // If the course has no department we cannot place it in the hierarchy
    // without inventing data. Leave subdepartmentId null and count it.
    //
    // Subdepartment name comes from course.subdepartment when present;
    // otherwise falls back to FALLBACK_SUBDEPARTMENT ("General").

    let subdepartmentId: number | null = null;

    if (course.department?.trim()) {
      const departmentId = await getOrCreateDepartment(course.department.trim());

      const subdeptName = course.subdepartment?.trim() || FALLBACK_SUBDEPARTMENT;
      subdepartmentId = await getOrCreateSubdepartment(departmentId, subdeptName);
    } else {
      noDepartment += 1;
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
      // A P2002 on (subdepartmentId, title) means a different record with the
      // same title already occupies this subdepartment slot.  This is a data
      // quality issue in the source — log it and skip so the run stays clean.
      const isPrismaUniqueViolation =
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002";

      if (isPrismaUniqueViolation) {
        failedRecords.push({
          title: course.title,
          sourceReference: course.sourceReference,
          reason: `title already exists under this subdepartment (importKey=${importKey})`,
        });
        continue;
      }
      throw err;
    }
    coursesUpserted += 1;

    // -- Offerings  — upsert by courseCode -------------------------------
    for (const offering of course.offerings!) {
      await prisma.courseOffering.upsert({
        where: { courseCode: offering.courseCode! },
        create: {
          courseCode: offering.courseCode!,
          semesterLabel: offering.semesterLabel ?? null,
          duration: offering.duration ?? null,
          gradeLevels: requireArray(offering.gradeLevels),
          prerequisites: requireArray(offering.prerequisites),
          corequisites: requireArray(offering.corequisites),
          creditType: offering.creditType ?? null,
          credits: offering.credits ?? null,
          courseId: savedCourse.id,
        },
        update: {
          semesterLabel: offering.semesterLabel ?? null,
          duration: offering.duration ?? null,
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
        totalCoursesInFile: courses.length,
        coursesUpserted,
        offeringsUpserted,
        departmentsCached: departmentCache.size,
        subdepartmentsCached: subdepartmentCache.size,
        coursesWithNoDepartment: noDepartment,
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

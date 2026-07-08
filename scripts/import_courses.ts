import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeDepartment, parseSemester, parseDurationUnits } from "./lib/normalize";

// ---------------------------------------------------------------------------
// Input types — matches the cleaned academic-data JSON produced by the
// extraction/normalization stage.
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

type CourseChoiceInput = {
  name?: string;
  isOnline?: boolean;
  creditType?: string | null;
  credits?: number | null;
  gpaWaiverOption?: boolean;
  attributes?: string[] | Record<string, unknown>;
  offerings?: CourseOfferingInput[];
};

type CourseInput = {
  title?: string;
  department?: string | null;
  subdepartment?: string | null;
  description?: string | null;
  gpaWaiverOption?: boolean;
  isOnline?: boolean;
  creditType?: string | null;
  credits?: number | null;
  fulfillsRequirements?: string[];
  isRepeatable?: boolean;
  attributes?: string[] | Record<string, unknown>;
  choices?: CourseChoiceInput[];
  offerings?: CourseOfferingInput[];
  notes?: string[];
  sourceReference?: string | null;
};

type GraduationRequirementInput = {
  name?: string;
  category?: string | null;
  requirementType?: string | null;
  requiredValue?: number | null;
  notes?: string[];
  sourceReference?: string | null;
};

type ExtractedCatalog = {
  departments?: { name?: string; description?: string | null }[];
  courses?: CourseInput[];
  graduationRequirements?: GraduationRequirementInput[];
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

const INPUT_PATH = process.argv[2] ?? path.resolve("extractor", "output", "academic-data.json");

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

const departmentCache = new Map<string, number>();
const subdepartmentCache = new Map<string, number>();
const graduationRequirementCache = new Map<string, number>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireArray<T>(value: T[] | undefined, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}

function importKeyFor(course: CourseInput): string {
  return `${course.sourceReference ?? ""}::${course.title}`;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Convert the flexible `attributes` field into a normalized string array and
 * extract the dedicated `isRepeatable` flag. Handles both the new array format
 * (e.g. ["repeatable", "fineArtsCredit"]) and the legacy object format from
 * the extractor (e.g. { isRepeatable: false, requiresAudition: true }).
 */
function normalizeAttributes(attrs: string[] | Record<string, unknown> | undefined): {
  attributes: string[];
  isRepeatable: boolean;
} {
  const result = new Set<string>();
  let isRepeatable = false;

  if (Array.isArray(attrs)) {
    for (const raw of attrs) {
      if (typeof raw !== "string") continue;
      const key = raw === "isRepeatable" ? "repeatable" : raw;
      if (key === "repeatable") isRepeatable = true;
      result.add(key);
    }
  } else if (typeof attrs === "object" && attrs !== null) {
    for (const [raw, value] of Object.entries(attrs)) {
      if (value !== true) continue;
      const key = raw === "isRepeatable" ? "repeatable" : raw;
      if (key === "repeatable") isRepeatable = true;
      result.add(key);
    }
  }

  return { attributes: Array.from(result), isRepeatable };
}

function gradeRange(levels: number[] | undefined): { gradeMin: number | null; gradeMax: number | null } {
  if (!Array.isArray(levels) || levels.length === 0) {
    return { gradeMin: null, gradeMax: null };
  }
  const sorted = levels.filter((n) => typeof n === "number").sort((a, b) => a - b);
  if (sorted.length === 0) return { gradeMin: null, gradeMax: null };
  return { gradeMin: sorted[0], gradeMax: sorted[sorted.length - 1] };
}

// ---------------------------------------------------------------------------
// Pre-write validation
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
      if (!Array.isArray(course.choices) || course.choices.length === 0) {
        fail("missing offerings and choices");
        continue;
      }
    }
    if (seenImportKeys.has(importKey)) {
      fail(`duplicate importKey in input: ${importKey}`);
      continue;
    }

    let offeringConflict: string | null = null;
    const allOfferings = Array.isArray(course.offerings) ? [...course.offerings] : [];
    if (Array.isArray(course.choices)) {
      for (const choice of course.choices) {
        if (Array.isArray(choice.offerings)) {
          allOfferings.push(...choice.offerings);
        }
      }
    }
    for (const offering of allOfferings) {
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

    seenImportKeys.add(importKey);
    for (const offering of allOfferings) {
      seenCourseCodes.add(offering.courseCode!);
    }
    valid.push(course);
  }

  return { valid, failedRecords };
}

// ---------------------------------------------------------------------------
// Department / Subdepartment
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

async function getOrCreateSubdepartment(departmentId: number, name: string): Promise<number> {
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
// Graduation requirements
// ---------------------------------------------------------------------------

async function importGraduationRequirements(
  requirements: GraduationRequirementInput[]
): Promise<{ imported: number; failed: FailedRecord[] }> {
  const failed: FailedRecord[] = [];
  let imported = 0;

  for (const req of requirements) {
    if (!req.name?.trim()) {
      failed.push({ reason: "missing graduation requirement name" });
      continue;
    }

    const saved = await prisma.graduationRequirement.upsert({
      where: {
        name_category_requirementType: {
          name: req.name,
          category: req.category ?? null,
          requirementType: req.requirementType ?? null,
        },
      },
      create: {
        name: req.name,
        normalizedName: normalizeTitle(req.name),
        category: req.category ?? null,
        requirementType: req.requirementType ?? null,
        requiredValue: req.requiredValue ?? null,
        notes: requireArray(req.notes),
        sourceReference: req.sourceReference ?? null,
      },
      update: {
        normalizedName: normalizeTitle(req.name),
        category: req.category ?? null,
        requirementType: req.requirementType ?? null,
        requiredValue: req.requiredValue ?? null,
        notes: requireArray(req.notes),
        sourceReference: req.sourceReference ?? null,
      },
      select: { id: true, name: true },
    });

    graduationRequirementCache.set(saved.name, saved.id);
    imported += 1;
  }

  return { imported, failed };
}

function resolveRequirementId(reqName: string): number | null {
  // Exact match first.
  const exact = graduationRequirementCache.get(reqName);
  if (exact !== undefined) return exact;

  // Strip common suffixes and try again.
  const stripped = reqName
    .replace(/\s+Graduation Requirement\s+and\s+Waivers$/i, "")
    .replace(/\s+Graduation Requirement$/i, "");
  if (stripped !== reqName) {
    const suffixMatch = graduationRequirementCache.get(stripped);
    if (suffixMatch !== undefined) return suffixMatch;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Course options
// ---------------------------------------------------------------------------

type BuildOption = {
  name: string;
  isOnline: boolean;
  creditType: string | null;
  credits: number | null;
  gpaWaiverOption: boolean;
  attributes: string[];
  offerings: CourseOfferingInput[];
};

function buildCourseOptions(course: CourseInput): BuildOption[] {
  const { attributes: baseAttrs } = normalizeAttributes(course.attributes);

  if (Array.isArray(course.choices) && course.choices.length > 0) {
    return course.choices.map((choice) => {
      const choiceAttrs = normalizeAttributes(choice.attributes);
      return {
        name: choice.name?.trim() || "Regular",
        isOnline: Boolean(choice.isOnline),
        creditType: choice.creditType ?? course.creditType ?? null,
        credits: choice.credits ?? course.credits ?? null,
        gpaWaiverOption: choice.gpaWaiverOption ?? course.gpaWaiverOption ?? false,
        attributes: choiceAttrs.attributes.length > 0 ? choiceAttrs.attributes : baseAttrs,
        offerings: Array.isArray(choice.offerings) ? choice.offerings : requireArray(course.offerings),
      };
    });
  }

  return [
    {
      name: "Regular",
      isOnline: Boolean(course.isOnline),
      creditType: course.creditType ?? null,
      credits: course.credits ?? null,
      gpaWaiverOption: course.gpaWaiverOption ?? false,
      attributes: baseAttrs,
      offerings: requireArray(course.offerings),
    },
  ];
}

async function getOrCreateCourseOption(
  courseId: number,
  option: BuildOption
): Promise<{ id: number }> {
  const existing = await prisma.courseOption.findFirst({
    where: { courseId, name: option.name },
    select: { id: true },
  });

  if (existing) {
    await prisma.courseOption.update({
      where: { id: existing.id },
      data: {
        isOnline: option.isOnline,
        creditType: option.creditType,
        credits: option.credits,
        gpaWaiverOption: option.gpaWaiverOption,
        attributes: option.attributes,
      },
    });
    return { id: existing.id };
  }

  const created = await prisma.courseOption.create({
    data: {
      name: option.name,
      isOnline: option.isOnline,
      creditType: option.creditType,
      credits: option.credits,
      gpaWaiverOption: option.gpaWaiverOption,
      attributes: option.attributes,
      courseId,
    },
    select: { id: true },
  });
  return { id: created.id };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const raw = await readFile(INPUT_PATH, "utf8");
  const catalog = JSON.parse(raw) as ExtractedCatalog;
  const allCourses = Array.isArray(catalog.courses) ? catalog.courses : [];
  const allRequirements = Array.isArray(catalog.graduationRequirements)
    ? catalog.graduationRequirements
    : [];

  const { valid: courses, failedRecords } = validateAll(allCourses);

  // -- Graduation requirements ------------------------------------------------
  const { imported: requirementsImported, failed: requirementFailures } =
    await importGraduationRequirements(allRequirements);
  failedRecords.push(...requirementFailures);

  // -- Courses -----------------------------------------------------------------
  let coursesUpserted = 0;
  let optionsUpserted = 0;
  let offeringsUpserted = 0;
  let requirementsLinked = 0;
  let missingRequirements = 0;
  let coursesWithNoDepartment = 0;
  let coursesWithNoSubdepartment = 0;

  for (const course of courses) {
    const norm = normalizeDepartment(course.department);

    let departmentId: number | null = null;
    let subdepartmentId: number | null = null;

    if (norm.department) {
      departmentId = await getOrCreateDepartment(norm.department);
      if (norm.subdepartment) {
        subdepartmentId = await getOrCreateSubdepartment(departmentId, norm.subdepartment);
      } else {
        coursesWithNoSubdepartment += 1;
      }
    } else {
      coursesWithNoDepartment += 1;
    }

    const importKey = importKeyFor(course);
    const { attributes, isRepeatable } = normalizeAttributes(course.attributes);
    const finalIsRepeatable = course.isRepeatable ?? isRepeatable;

    let savedCourse: { id: number };
    try {
      savedCourse = await prisma.course.upsert({
        where: { importKey },
        create: {
          title: course.title!,
          normalizedTitle: normalizeTitle(course.title!),
          importKey,
          description: course.description ?? null,
          attributes,
          fulfillsRequirements: requireArray(course.fulfillsRequirements),
          isRepeatable: finalIsRepeatable,
          notes: requireArray(course.notes),
          sourceReference: course.sourceReference ?? null,
          departmentId,
          subdepartmentId,
        },
        update: {
          title: course.title!,
          normalizedTitle: normalizeTitle(course.title!),
          description: course.description ?? null,
          attributes,
          fulfillsRequirements: requireArray(course.fulfillsRequirements),
          isRepeatable: finalIsRepeatable,
          notes: requireArray(course.notes),
          departmentId,
          subdepartmentId,
        },
        select: { id: true },
      });
    } catch (err: unknown) {
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

    // -- Course options + offerings --------------------------------------------
    const options = buildCourseOptions(course);
    for (const option of options) {
      const savedOption = await getOrCreateCourseOption(savedCourse.id, option);
      optionsUpserted += 1;

      for (const offering of option.offerings) {
        const { gradeMin, gradeMax } = gradeRange(offering.gradeLevels);
        const semester = parseSemester(offering.semesterLabel);
        const durationUnits = parseDurationUnits(offering.duration);

        await prisma.courseOffering.upsert({
          where: { courseCode: offering.courseCode! },
          create: {
            courseCode: offering.courseCode!,
            semesterLabel: semester !== null ? String(semester) : offering.semesterLabel ?? null,
            duration: durationUnits !== null ? String(durationUnits) : offering.duration ?? null,
            gradeMin,
            gradeMax,
            prerequisites: requireArray(offering.prerequisites),
            corequisites: requireArray(offering.corequisites),
            creditType: offering.creditType ?? option.creditType ?? null,
            credits: offering.credits ?? option.credits ?? null,
            courseOptionId: savedOption.id,
          },
          update: {
            semesterLabel: semester !== null ? String(semester) : offering.semesterLabel ?? null,
            duration: durationUnits !== null ? String(durationUnits) : offering.duration ?? null,
            gradeMin,
            gradeMax,
            prerequisites: requireArray(offering.prerequisites),
            corequisites: requireArray(offering.corequisites),
            creditType: offering.creditType ?? option.creditType ?? null,
            credits: offering.credits ?? option.credits ?? null,
            courseOptionId: savedOption.id,
          },
        });
        offeringsUpserted += 1;
      }
    }

    // -- Graduation requirement links ----------------------------------------
    for (const reqName of requireArray(course.fulfillsRequirements)) {
      const reqId = resolveRequirementId(reqName);
      if (reqId === null) {
        missingRequirements += 1;
        failedRecords.push({
          title: course.title,
          sourceReference: course.sourceReference,
          importKey,
          reason: `no matching graduation requirement: "${reqName}"`,
        });
        continue;
      }

      try {
        await prisma.courseRequirement.upsert({
          where: {
            courseId_graduationRequirementId: {
              courseId: savedCourse.id,
              graduationRequirementId: reqId,
            },
          },
          create: {
            courseId: savedCourse.id,
            graduationRequirementId: reqId,
          },
          update: {},
        });
        requirementsLinked += 1;
      } catch (err: unknown) {
        const isPrismaUniqueViolation =
          typeof err === "object" &&
          err !== null &&
          (err as { code?: string }).code === "P2002";
        if (isPrismaUniqueViolation) {
          continue;
        }
        throw err;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        inputPath: INPUT_PATH,
        totalCoursesInFile: allCourses.length,
        coursesUpserted,
        optionsUpserted,
        offeringsUpserted,
        requirementsImported,
        requirementsLinked,
        missingRequirements,
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

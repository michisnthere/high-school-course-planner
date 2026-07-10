import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseSemester, parseDurationUnits } from "./lib/normalize";

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
  division?: string | null;
  department?: string | null;
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

type DivisionInput = {
  name?: string;
  description?: string | null;
  departments?: { name?: string; description?: string | null }[];
};

type ExtractedCatalog = {
  divisions?: DivisionInput[];
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

const divisionCache = new Map<string, number>();
const departmentCache = new Map<string, number>(); // key: "divisionId:departmentName"
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
    if (!course.division?.trim()) {
      fail("missing division");
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

    // Validate offerings per option group. Duplicate courseCodes are allowed
    // across different course options (different choices), but not within the
    // same option group.
    const optionGroups: CourseOfferingInput[][] = [];
    if (Array.isArray(course.offerings) && course.offerings.length > 0) {
      optionGroups.push(course.offerings);
    }
    if (Array.isArray(course.choices)) {
      for (const choice of course.choices) {
        if (Array.isArray(choice.offerings) && choice.offerings.length > 0) {
          optionGroups.push(choice.offerings);
        }
      }
    }

    for (const group of optionGroups) {
      const seenCourseCodes = new Set<string>();
      for (const offering of group) {
        if (!offering.courseCode?.trim()) {
          offeringConflict = `missing courseCode for "${course.title}"`;
          break;
        }
        if (seenCourseCodes.has(offering.courseCode)) {
          offeringConflict = `duplicate courseCode in input: ${offering.courseCode}`;
          break;
        }
        seenCourseCodes.add(offering.courseCode);
      }
      if (offeringConflict) break;
    }

    if (offeringConflict) {
      fail(offeringConflict);
      continue;
    }

    seenImportKeys.add(importKey);
    valid.push(course);
  }

  return { valid, failedRecords };
}

// ---------------------------------------------------------------------------
// Division / Department
// ---------------------------------------------------------------------------

async function getOrCreateDivision(name: string, description?: string | null): Promise<number> {
  const cached = divisionCache.get(name);
  if (cached !== undefined) return cached;

  const division = await prisma.division.upsert({
    where: { name },
    create: {
      name,
      normalizedName: normalizeTitle(name),
      description: description ?? null,
    },
    update: {
      normalizedName: normalizeTitle(name),
      description: description ?? null,
    },
    select: { id: true },
  });

  divisionCache.set(name, division.id);
  return division.id;
}

async function getOrCreateDepartment(
  divisionId: number,
  name: string,
  description?: string | null
): Promise<number> {
  const cacheKey = `${divisionId}:${name}`;
  const cached = departmentCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const department = await prisma.department.upsert({
    where: { divisionId_name: { divisionId, name } },
    create: {
      name,
      normalizedName: normalizeTitle(name),
      description: description ?? null,
      divisionId,
    },
    update: {
      normalizedName: normalizeTitle(name),
      description: description ?? null,
    },
    select: { id: true },
  });

  departmentCache.set(cacheKey, department.id);
  return department.id;
}

async function resolveDepartment(
  divisionId: number,
  divisionName: string,
  departmentName: string | null | undefined
): Promise<number> {
  if (departmentName?.trim()) {
    return getOrCreateDepartment(divisionId, departmentName.trim());
  }
  // Division-only course: create a default department matching the division name.
  return getOrCreateDepartment(divisionId, divisionName);
}

async function importDivisions(divisions: DivisionInput[]): Promise<{
  imported: number;
  failed: FailedRecord[];
}> {
  const failed: FailedRecord[] = [];
  let imported = 0;

  for (const div of divisions) {
    if (!div.name?.trim()) {
      failed.push({ reason: "missing division name" });
      continue;
    }
    const divisionId = await getOrCreateDivision(div.name, div.description);
    imported += 1;

    for (const dept of requireArray(div.departments)) {
      if (!dept.name?.trim()) {
        failed.push({ reason: `missing department name under division ${div.name}` });
        continue;
      }
      await getOrCreateDepartment(divisionId, dept.name, dept.description);
    }
  }

  return { imported, failed };
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
  const exact = graduationRequirementCache.get(reqName);
  if (exact !== undefined) return exact;

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
  const allDivisions = Array.isArray(catalog.divisions) ? catalog.divisions : [];

  const { valid: courses, failedRecords } = validateAll(allCourses);

  // -- Divisions + Departments ------------------------------------------------
  const { imported: divisionsImported, failed: divisionFailures } = await importDivisions(allDivisions);
  failedRecords.push(...divisionFailures);

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

  for (const course of courses) {
    const divisionName = course.division!.trim();
    const divisionId = await getOrCreateDivision(divisionName);
    const departmentId = await resolveDepartment(divisionId, divisionName, course.department);

    if (!course.department?.trim()) {
      coursesWithNoDepartment += 1;
    }

    const importKey = importKeyFor(course);
    const { attributes, isRepeatable } = normalizeAttributes(course.attributes);
    const finalIsRepeatable = course.isRepeatable ?? isRepeatable;

    // Compute the normalized course duration from all offerings (1 = one semester, 2 = full year).
    const allOfferings = Array.isArray(course.choices) && course.choices.length > 0
      ? course.choices.flatMap((choice) => choice.offerings ?? course.offerings ?? [])
      : (course.offerings ?? []);
    const parsedDurations = allOfferings
      .map((offering) => parseDurationUnits(offering.duration))
      .filter((d): d is number => d !== null);
    const courseDuration = parsedDurations.length > 0 ? Math.max(...parsedDurations) : null;

    let savedCourse: { id: number };
    try {
      savedCourse = await prisma.course.upsert({
        where: { importKey },
        create: {
          title: course.title!,
          normalizedTitle: normalizeTitle(course.title!),
          importKey,
          description: course.description ?? null,
          duration: courseDuration ?? null,
          attributes,
          fulfillsRequirements: requireArray(course.fulfillsRequirements),
          isRepeatable: finalIsRepeatable,
          notes: requireArray(course.notes),
          sourceReference: course.sourceReference ?? null,
          departmentId,
        },
        update: {
          title: course.title!,
          normalizedTitle: normalizeTitle(course.title!),
          description: course.description ?? null,
          duration: courseDuration ?? null,
          attributes,
          fulfillsRequirements: requireArray(course.fulfillsRequirements),
          isRepeatable: finalIsRepeatable,
          notes: requireArray(course.notes),
          departmentId,
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
          reason: "title already exists under this department (conflicting course, not overwritten)",
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
          where: {
            courseOptionId_courseCode: {
              courseOptionId: savedOption.id,
              courseCode: offering.courseCode!,
            },
          },
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
        divisionsImported,
        departmentsImported: departmentCache.size,
        requirementsImported,
        requirementsLinked,
        missingRequirements,
        coursesWithNoDepartment,
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

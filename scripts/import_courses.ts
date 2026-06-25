import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

const INPUT_PATH = path.resolve("data", "extracted_courses.json");
const prisma = new PrismaClient();

function requireArray<T>(value: T[] | undefined, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}

function validateCourse(course: CourseInput, seenCodes: Set<string>): string | null {
  if (!course.title || !course.title.trim()) {
    return "missing title";
  }
  if (!Array.isArray(course.offerings) || course.offerings.length === 0) {
    return "missing offerings";
  }
  for (const offering of course.offerings) {
    if (!offering.courseCode || !offering.courseCode.trim()) {
      return `missing courseCode for ${course.title}`;
    }
    if (seenCodes.has(offering.courseCode)) {
      return `duplicate courseCode in input: ${offering.courseCode}`;
    }
    seenCodes.add(offering.courseCode);
  }
  return null;
}

function importKeyFor(course: CourseInput): string {
  return `${course.sourceReference ?? ""}::${course.title}`;
}

async function loadCatalog(): Promise<ExtractedCatalog> {
  const raw = await readFile(INPUT_PATH, "utf8");
  return JSON.parse(raw) as ExtractedCatalog;
}

async function main() {
  const catalog = await loadCatalog();
  const courses = requireArray(catalog.courses);
  const seenCodes = new Set<string>();
  const failedRecords: FailedRecord[] = [];
  let coursesUpserted = 0;
  let offeringsUpserted = 0;
  let departmentsCreated = 0;
  let subdepartmentsCreated = 0;
  let skippedDuplicates = 0;

  for (const course of courses) {
    const validationError = validateCourse(course, seenCodes);
    if (validationError) {
      failedRecords.push({
        title: course.title,
        sourceReference: course.sourceReference,
        reason: validationError,
      });
      continue;
    }

    let subdepartmentId: number | null = null;
    if (course.department) {
      const existingDept = await prisma.department.findUnique({
        where: { name: course.department },
        select: { id: true },
      });
      const department = await prisma.department.upsert({
        where: { name: course.department },
        create: { name: course.department },
        update: {},
      });
      if (!existingDept) {
        departmentsCreated += 1;
      }

      const subdeptName = course.department;
      const existingSubdept = await prisma.subdepartment.findUnique({
        where: { departmentId_name: { departmentId: department.id, name: subdeptName } },
        select: { id: true },
      });
      const subdepartment = await prisma.subdepartment.upsert({
        where: { departmentId_name: { departmentId: department.id, name: subdeptName } },
        create: { name: subdeptName, departmentId: department.id },
        update: {},
      });
      subdepartmentId = subdepartment.id;
      if (!existingSubdept) {
        subdepartmentsCreated += 1;
      }
    }

    const importKey = importKeyFor(course);

    let existingCourse = await prisma.course.findUnique({
      where: { importKey },
      select: { id: true },
    });

    if (!existingCourse && subdepartmentId !== null) {
      existingCourse = await prisma.course.findUnique({
        where: { subdepartmentId_title: { subdepartmentId, title: course.title! } },
        select: { id: true },
      });
    }

    if (existingCourse) {
      skippedDuplicates += 1;
    }

    let savedCourse: { id: number };
    if (existingCourse) {
      savedCourse = await prisma.course.update({
        where: { id: existingCourse.id },
        data: {
          description: course.description ?? null,
          gpaWaiverOption: Boolean(course.gpaWaiverOption),
          isOnline: Boolean(course.isOnline),
          notes: requireArray(course.notes),
          subdepartmentId,
        },
        select: { id: true },
      });
    } else {
      savedCourse = await prisma.course.create({
        data: {
          title: course.title!,
          importKey,
          description: course.description ?? null,
          gpaWaiverOption: Boolean(course.gpaWaiverOption),
          isOnline: Boolean(course.isOnline),
          notes: requireArray(course.notes),
          sourceReference: course.sourceReference ?? null,
          subdepartmentId,
        },
        select: { id: true },
      });
    }
    coursesUpserted += 1;

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

  console.log(JSON.stringify({
    inputPath: INPUT_PATH,
    totalCoursesInFile: courses.length,
    coursesUpserted,
    offeringsUpserted,
    departmentsCreated,
    subdepartmentsCreated,
    failedRecords,
    skippedDuplicates,
  }, null, 2));

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

import { PrismaClient } from "@prisma/client";
import { canonicalRequirementName } from "./requirementsCleanup.js";

export type BackfillResult = {
  updatedCount: number;
  alreadyCorrectCount: number;
  noMappingCount: number;
};

/**
 * Backfill `Course.fulfillsRequirements` JSON field from the
 * `CourseRequirement` join table.
 *
 * The import pipeline populates the join table but not the JSON cache.
 * This function restores the cache so the planner year page can read
 * requirement fulfillment without a join.
 */
export async function backfillFulfillsRequirements(
  prisma: PrismaClient
): Promise<BackfillResult> {
  // -- Index all graduation requirements by canonical name ------------------
  const allGradReqs = await prisma.graduationRequirement.findMany();
  const canonicalNameToIds = new Map<string, Set<number>>();
  const idToCanonicalName = new Map<number, string>();

  for (const req of allGradReqs) {
    const canonical = canonicalRequirementName(req.name);
    idToCanonicalName.set(req.id, canonical);
    const ids = canonicalNameToIds.get(canonical) ?? new Set();
    ids.add(req.id);
    canonicalNameToIds.set(canonical, ids);
  }

  // -- Reverse index: canonical-name -> set of course IDs -------------------
  const allLinks = await prisma.courseRequirement.findMany({
    select: { courseId: true, graduationRequirementId: true },
  });

  const courseToCanonicalNames = new Map<number, Set<string>>();
  for (const link of allLinks) {
    const canonical = idToCanonicalName.get(link.graduationRequirementId);
    if (!canonical) continue;
    const names = courseToCanonicalNames.get(link.courseId) ?? new Set();
    names.add(canonical);
    courseToCanonicalNames.set(link.courseId, names);
  }

  // -- Process every course -------------------------------------------------
  const allCourses = await prisma.course.findMany({
    select: { id: true, fulfillsRequirements: true },
    orderBy: { id: "asc" },
  });

  let updatedCount = 0;
  let alreadyCorrectCount = 0;
  let noMappingCount = 0;

  for (const course of allCourses) {
    const linkedNames = courseToCanonicalNames.get(course.id);
    if (!linkedNames || linkedNames.size === 0) {
      noMappingCount++;
      continue;
    }

    const sorted = Array.from(linkedNames).sort((a, b) => a.localeCompare(b));

    const before: string[] = Array.isArray(course.fulfillsRequirements)
      ? course.fulfillsRequirements.filter((r): r is string => typeof r === "string")
      : [];

    if (JSON.stringify(before) === JSON.stringify(sorted)) {
      alreadyCorrectCount++;
      continue;
    }

    await prisma.course.update({
      where: { id: course.id },
      data: { fulfillsRequirements: sorted },
    });
    updatedCount++;
  }

  return { updatedCount, alreadyCorrectCount, noMappingCount };
}

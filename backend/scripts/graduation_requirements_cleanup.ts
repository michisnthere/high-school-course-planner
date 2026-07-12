import { PrismaClient } from "@prisma/client";
import { analyzePlanners } from "../src/lib/plannerAnalysis.js";
import {
  canonicalRequirementName,
  isInformationItem,
  isMeasurableGraduationRequirement,
  isNonGraduationRequirementName,
  normalizeRequirementNames,
} from "../src/lib/requirementsCleanup.js";

const prisma = new PrismaClient();

type AnalysisSummary = {
  earned: number;
  recommendations: number;
};

async function summarizeFirstUser(): Promise<AnalysisSummary | null> {
  const user = await prisma.user.findFirst({ orderBy: { id: "asc" } });
  if (!user) return null;

  const analysis = await analyzePlanners(user.id);
  return {
    earned: analysis.graduationRequirements.reduce((sum, req) => sum + req.earnedValue, 0),
    recommendations: analysis.graduationRequirements.reduce(
      (sum, req) => sum + req.recommendedCourses.length,
      0
    ),
  };
}

async function main() {
  const beforeLinks = await prisma.courseRequirement.findMany();
  const beforeLinkKeys = new Set(beforeLinks.map((link) => `${link.courseId}:${link.graduationRequirementId}`));
  const beforeAnalysis = await summarizeFirstUser();

  const requirements = await prisma.graduationRequirement.findMany({ orderBy: { id: "asc" } });
  const byCanonicalName = new Map<string, typeof requirements>();
  const removedNonGraduation: string[] = [];
  const informationalItems: string[] = [];

  for (const req of requirements) {
    const canonicalName = canonicalRequirementName(req.name);
    if (isNonGraduationRequirementName(canonicalName)) {
      removedNonGraduation.push(req.name);
      continue;
    }
    if (isInformationItem(req)) {
      informationalItems.push(canonicalName);
      continue;
    }
    if (!isMeasurableGraduationRequirement({ ...req, name: canonicalName })) {
      informationalItems.push(canonicalName);
      continue;
    }
    const list = byCanonicalName.get(canonicalName) ?? [];
    list.push(req);
    byCanonicalName.set(canonicalName, list);
  }

  const canonicalByOldId = new Map<number, { id: number; name: string }>();
  const mergedRequirements: string[] = [];

  for (const [name, reqs] of byCanonicalName) {
    const keeper = reqs.find((req) => req.name === name) ?? reqs[0];
    for (const req of reqs) {
      canonicalByOldId.set(req.id, { id: keeper.id, name });
    }
    if (reqs.length > 1 || keeper.name !== name) {
      mergedRequirements.push(`${reqs.map((req) => req.name).join(", ")} -> ${name}`);
    }
  }

  const existingTargetLinks = new Set<string>();
  const linksToCreate: Array<{ courseId: number; graduationRequirementId: number }> = [];
  const linkIdsToDelete: number[] = [];

  for (const link of beforeLinks) {
    const canonical = canonicalByOldId.get(link.graduationRequirementId);
    if (!canonical) {
      linkIdsToDelete.push(link.id);
      continue;
    }
    const key = `${link.courseId}:${canonical.id}`;
    if (existingTargetLinks.has(key)) {
      linkIdsToDelete.push(link.id);
    } else {
      existingTargetLinks.add(key);
      if (canonical.id !== link.graduationRequirementId) {
        linksToCreate.push({ courseId: link.courseId, graduationRequirementId: canonical.id });
        linkIdsToDelete.push(link.id);
      }
    }
  }

  const duplicateRequirementIds = requirements
    .filter((req) => {
      const canonical = canonicalByOldId.get(req.id);
      return canonical && canonical.id !== req.id;
    })
    .map((req) => req.id);
  const nonGraduationRequirementIds = requirements
    .filter((req) => isNonGraduationRequirementName(canonicalRequirementName(req.name)))
    .map((req) => req.id);

  await prisma.$transaction(async (tx) => {
    if (linkIdsToDelete.length > 0) {
      await tx.courseRequirement.deleteMany({ where: { id: { in: linkIdsToDelete } } });
    }
    if (linksToCreate.length > 0) {
      await tx.courseRequirement.createMany({ data: linksToCreate, skipDuplicates: true });
    }

    for (const [name, reqs] of byCanonicalName) {
      const keeper = reqs.find((req) => req.name === name) ?? reqs[0];
      const sourceWithValue = reqs.find((req) => req.requiredValue != null) ?? keeper;
      await tx.graduationRequirement.update({
        where: { id: keeper.id },
        data: {
          name,
          normalizedName: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
          category: sourceWithValue.category,
          requirementType: sourceWithValue.requirementType,
          requiredValue: sourceWithValue.requiredValue,
          notes: sourceWithValue.notes,
          sourceReference: sourceWithValue.sourceReference,
        },
      });
    }

    const removeRequirementIds = [...new Set([...duplicateRequirementIds, ...nonGraduationRequirementIds])];
    if (removeRequirementIds.length > 0) {
      await tx.graduationRequirement.deleteMany({ where: { id: { in: removeRequirementIds } } });
    }

    const courses = await tx.course.findMany({ select: { id: true, fulfillsRequirements: true } });
    for (const course of courses) {
      const current = Array.isArray(course.fulfillsRequirements)
        ? course.fulfillsRequirements.filter((req): req is string => typeof req === "string")
        : [];
      const normalized = normalizeRequirementNames(current);
      if (JSON.stringify(current) !== JSON.stringify(normalized)) {
        await tx.course.update({
          where: { id: course.id },
          data: { fulfillsRequirements: normalized },
        });
      }
    }
  });

  const afterRequirements = await prisma.graduationRequirement.findMany({ orderBy: { id: "asc" } });
  const afterLinks = await prisma.courseRequirement.findMany();
  const afterAnalysis = await summarizeFirstUser();

  const duplicateNames = afterRequirements
    .map((req) => req.name)
    .filter((name, index, names) => names.indexOf(name) !== index);
  const duplicateIds = afterRequirements
    .map((req) => req.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);

  const afterLinkCourseIds = new Set(afterLinks.map((link) => link.courseId));
  const beforeLinkedCourseIds = new Set(beforeLinks.map((link) => link.courseId));
  const missingLinkedCourseIds = Array.from(beforeLinkedCourseIds).filter((courseId) => !afterLinkCourseIds.has(courseId));

  console.log("Graduation requirements cleanup complete.");
  console.log("Merged requirements:");
  console.log(mergedRequirements.length ? mergedRequirements.map((item) => `- ${item}`).join("\n") : "- none");
  console.log("Removed non-graduation requirements:");
  console.log([...new Set(removedNonGraduation)].map((item) => `- ${item}`).join("\n") || "- none");
  console.log("Informational items created:");
  console.log([...new Set(informationalItems)].sort().map((item) => `- ${item}`).join("\n") || "- none");
  console.log("Validation:");
  console.log(`- duplicate graduation requirement names: ${duplicateNames.length}`);
  console.log(`- duplicate requirement IDs: ${duplicateIds.length}`);
  console.log(`- linked course IDs preserved: ${missingLinkedCourseIds.length === 0}`);
  console.log(`- course mappings before/after: ${beforeLinkKeys.size}/${afterLinks.length}`);
  if (beforeAnalysis && afterAnalysis) {
    console.log(`- earned credits before/after: ${beforeAnalysis.earned}/${afterAnalysis.earned}`);
    console.log(`- recommendations before/after: ${beforeAnalysis.recommendations}/${afterAnalysis.recommendations}`);
  }

  if (duplicateNames.length > 0 || duplicateIds.length > 0 || missingLinkedCourseIds.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

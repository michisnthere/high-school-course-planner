import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyzePlanners } from "../src/lib/plannerAnalysis.js";

const prisma = new PrismaClient();

const INPUT_PATH = path.resolve("extractor", "output", "academic-data.json");

// Source requirement name -> canonical GraduationRequirement ID after the
// cleanup migration. Both core and official "Graduation Requirement" suffix
// names are mapped to the same canonical ID.
const SOURCE_NAME_TO_CANONICAL_ID = new Map<string, number>([
  ["Minimum", 1],
  ["Civics and Patriotism", 2],
  ["Civics and Patriotism Graduation Requirements", 2],
  ["Driver Education", 3],
  ["Driver Education Graduation Requirement", 3],
  ["Elective Graduation Requirement", 4],
  ["Economics or Personal Finance", 5],
  ["Economics or Personal Finance Graduation Requirement", 5],
  ["English", 6],
  ["English Graduation Requirement", 6],
  ["Health", 7],
  ["Health Graduation Requirement", 7],
  ["Mathematics", 8],
  ["Mathematics Graduation Requirement", 8],
  ["Physical Welfare", 9],
  ["Physical Welfare Graduation Requirement and Waivers", 9],
  ["Science", 10],
  ["Science Graduation Requirement", 10],
  ["Social Studies", 11],
  ["Social Studies Graduation Requirement", 11],
  ["ACT", 12],
  ["ACT Graduation Requirement", 12],
  ["Fafsa", 13],
  ["Total Credits", 13],
  ["Biology", 24],
  ["Physical Science", 25],
  ["U.S. History", 26],
  ["World History and Geography", 27],
  ["Government", 28],
  ["Required Electives and P.E.", 32],
  ["Additional Credits and P.E.", 33],
  ["FAFSA Graduation Requirement", 47],
  ["External Credits", 55],
]);

type SourceRequirement = {
  name?: string;
  category?: string | null;
  requirementType?: string | null;
  requiredValue?: number | null;
};

type SourceCourse = {
  title?: string;
  department?: string | null;
  fulfillsRequirements?: string[];
};

type AnalysisSummary = {
  requirementCount: number;
  totalEarned: number;
  totalRequired: number;
  totalRemaining: number;
  recommendationCount: number;
};

async function summarizeAnalysis(userId: number): Promise<AnalysisSummary> {
  const analysis = await analyzePlanners(userId);
  let totalEarned = 0;
  let totalRequired = 0;
  let totalRemaining = 0;
  let recommendationCount = 0;
  for (const req of analysis.graduationRequirements) {
    totalEarned += req.earnedValue;
    totalRequired += req.requiredValue ?? 0;
    totalRemaining += req.remainingValue;
    recommendationCount += (req.recommendedCourses ?? []).length;
  }
  return {
    requirementCount: analysis.graduationRequirements.length,
    totalEarned,
    totalRequired,
    totalRemaining,
    recommendationCount,
  };
}

async function main() {
  const raw = await readFile(INPUT_PATH, "utf-8");
  const source = JSON.parse(raw) as {
    graduationRequirements?: SourceRequirement[];
    courses?: SourceCourse[];
  };

  const user = await prisma.user.findFirst({ orderBy: { id: "asc" } });

  const beforeAnalysis = user ? await summarizeAnalysis(user.id) : null;

  // 1. Sync canonical requirement metadata (type, requiredValue) from source.
  const valueUpdates: Array<{ id: number; requirementType?: string; requiredValue?: number }> = [];
  for (const req of source.graduationRequirements ?? []) {
    if (!req.name) continue;
    const canonicalId = SOURCE_NAME_TO_CANONICAL_ID.get(req.name);
    if (!canonicalId) continue;
    valueUpdates.push({
      id: canonicalId,
      requirementType: req.requirementType ?? undefined,
      requiredValue: req.requiredValue ?? undefined,
    });
  }

  // 2. Build course lookup by title -> department -> course IDs.
  const courses = await prisma.course.findMany({
    select: { id: true, title: true, departmentId: true, department: { select: { name: true } } },
  });
  const coursesByTitleDept = new Map<string, number[]>();
  for (const c of courses) {
    const dept = c.department?.name ?? "__none__";
    const key = `${c.title}\t${dept}`;
    const list = coursesByTitleDept.get(key) ?? [];
    list.push(c.id);
    coursesByTitleDept.set(key, list);
  }

  // 3. Build existing CourseRequirement lookup to avoid conflicts.
  const existingLinks = new Set<string>();
  const allLinks = await prisma.courseRequirement.findMany({
    select: { courseId: true, graduationRequirementId: true },
  });
  for (const link of allLinks) {
    existingLinks.add(`${link.courseId}:${link.graduationRequirementId}`);
  }

  // 4. Compute missing links from source data.
  const linksToCreate: Array<{ courseId: number; graduationRequirementId: number }> = [];
  for (const sourceCourse of source.courses ?? []) {
    if (!sourceCourse.title) continue;
    const dept = sourceCourse.department ?? "__none__";
    const key = `${sourceCourse.title}\t${dept}`;
    const courseIds = coursesByTitleDept.get(key);
    if (!courseIds || courseIds.length === 0) continue;

    for (const reqName of sourceCourse.fulfillsRequirements ?? []) {
      const canonicalId = SOURCE_NAME_TO_CANONICAL_ID.get(reqName);
      if (!canonicalId) continue;
      for (const courseId of courseIds) {
        const linkKey = `${courseId}:${canonicalId}`;
        if (!existingLinks.has(linkKey)) {
          linksToCreate.push({ courseId, graduationRequirementId: canonicalId });
          existingLinks.add(linkKey);
        }
      }
    }
  }

  // 5. Apply changes in a transaction.
  await prisma.$transaction(async (tx) => {
    for (const update of valueUpdates) {
      await tx.graduationRequirement.update({
        where: { id: update.id },
        data: {
          requirementType: update.requirementType,
          requiredValue: update.requiredValue,
        },
      });
    }

    if (linksToCreate.length > 0) {
      await tx.courseRequirement.createMany({ data: linksToCreate, skipDuplicates: true });
    }
  });

  // 6. Verification.
  const afterAnalysis = user ? await summarizeAnalysis(user.id) : null;
  const afterLinkCount = await prisma.courseRequirement.count();

  const afterReqs = await prisma.graduationRequirement.findMany({
    select: { id: true, name: true, requirementType: true, requiredValue: true },
  });
  const reqsWithLinks = await prisma.courseRequirement.groupBy({
    by: ["graduationRequirementId"],
    _count: { courseId: true },
  });
  const reqsWithRecommendations = afterAnalysis
    ? await analyzePlanners(user.id).then((a) =>
        a.graduationRequirements.filter((r) => (r.recommendedCourses ?? []).length > 0).map((r) => r.name)
      )
    : [];

  console.log("\n=== Sync complete ===");
  console.log(`CourseRequirement count: ${allLinks.length} -> ${afterLinkCount} (+${afterLinkCount - allLinks.length})`);
  if (beforeAnalysis && afterAnalysis) {
    console.log("Analysis before:", beforeAnalysis);
    console.log("Analysis after:", afterAnalysis);
    if (beforeAnalysis.totalEarned !== afterAnalysis.totalEarned) {
      console.error("ERROR: totalEarned changed");
      process.exit(1);
    }
  }
  console.log("Requirements with links:", reqsWithLinks.map((g) => `${g.graduationRequirementId}: ${g._count.courseId}`).join(", "));
  console.log("Requirements with recommendations:", reqsWithRecommendations.join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

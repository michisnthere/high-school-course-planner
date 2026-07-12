import { PrismaClient } from "@prisma/client";
import { analyzePlanners } from "../src/lib/plannerAnalysis.js";

const prisma = new PrismaClient();

// Canonical IDs to keep and their final names. Prefer the original seeded ID
// whenever one exists for a requirement; otherwise keep the imported ID.
const canonicalNames = new Map<number, string>([
  [1, "Minimum"],
  [2, "Civics and Patriotism Graduation Requirements"],
  [3, "Driver Education Graduation Requirement"],
  [4, "Elective Graduation Requirement"],
  [5, "Economics or Personal Finance Graduation Requirement"],
  [6, "English"],
  [7, "Health Graduation Requirement"],
  [8, "Mathematics Graduation Requirement"],
  [9, "Physical Welfare Graduation Requirement and Waivers"],
  [10, "Science"],
  [11, "Social Studies"],
  [12, "ACT"],
  [13, "Total Credits"],
  // Imported sub-requirements with no original canonical ID.
  [24, "Biology"],
  [25, "Physical Science"],
  [26, "U.S. History"],
  [27, "World History and Geography"],
  [28, "Government"],
  // Other imported requirements with no original canonical ID.
  [32, "Required Electives and P.E."],
  [33, "Additional Credits and P.E."],
  [47, "FAFSA Graduation Requirement"],
  [48, "The “46th Credit” Graduation Requirement"],
  [55, "External Credits"],
]);

// Map duplicate requirement IDs to the canonical ID that should absorb them.
const duplicateToCanonical = new Map<number, number>([
  [14, 1],
  [16, 1],
  [22, 6],
  [40, 6],
  [23, 8],
  [42, 8],
  [29, 5],
  [39, 5],
  [30, 7],
  [41, 7],
  [31, 3],
  [37, 3],
  [36, 2],
  [38, 4],
  [43, 9],
  [34, 13],
  [44, 10],
  [45, 11],
  [46, 12],
]);

// Replace old requirement names in Course.fulfillsRequirements with the
// canonical name. Only exact-string matches are replaced.
const nameReplacements = new Map<string, string>([
  ["Stevenson High School Minimum", "Minimum"],
  ["It Is Important To Emphasize That The", "Minimum"],
  ["Mathematics", "Mathematics Graduation Requirement"],
  ["Economics or Personal Finance", "Economics or Personal Finance Graduation Requirement"],
  ["Health", "Health Graduation Requirement"],
  ["Physical Welfare", "Physical Welfare Graduation Requirement and Waivers"],
  ["Driver Education", "Driver Education Graduation Requirement"],
  ["Civics and Patriotism", "Civics and Patriotism Graduation Requirements"],
  ["Elective", "Elective Graduation Requirement"],
  ["Fafsa", "Total Credits"],
  ["Science Graduation Requirement", "Science"],
  ["Social Studies Graduation Requirement", "Social Studies"],
  ["ACT Graduation Requirement", "ACT"],
  ["English Graduation Requirement", "English"],
]);

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
  const user = await prisma.user.findFirst({ orderBy: { id: "asc" } });
  if (!user) {
    console.warn("No user found; skipping before/after analysis comparison.");
  }

  // Capture before state.
  const beforeRequirements = await prisma.graduationRequirement.findMany();
  const beforeCourseReqCount = await prisma.courseRequirement.count();
  const beforeAnalysis = user ? await summarizeAnalysis(user.id) : null;

  // Compute link migration plan.
  const allCourseReqs = await prisma.courseRequirement.findMany();
  const existingCanonicalLinks = new Set<string>();
  for (const cr of allCourseReqs) {
    if (!duplicateToCanonical.has(cr.graduationRequirementId)) {
      existingCanonicalLinks.add(`${cr.courseId}:${cr.graduationRequirementId}`);
    }
  }

  const linksToUpdate: Array<{ id: number; canonicalId: number }> = [];
  const linksToDelete: number[] = [];
  for (const cr of allCourseReqs) {
    const canonicalId = duplicateToCanonical.get(cr.graduationRequirementId);
    if (!canonicalId) continue;
    const key = `${cr.courseId}:${canonicalId}`;
    if (existingCanonicalLinks.has(key)) {
      linksToDelete.push(cr.id);
    } else {
      linksToUpdate.push({ id: cr.id, canonicalId });
      existingCanonicalLinks.add(key);
    }
  }

  // Run migration in a transaction.
  await prisma.$transaction(async (tx) => {
    // 1. Remove duplicate links that would collide with an existing canonical link.
    if (linksToDelete.length > 0) {
      await tx.courseRequirement.deleteMany({
        where: { id: { in: linksToDelete } },
      });
    }

    // 2. Move remaining duplicate links to the canonical requirement.
    for (const { id, canonicalId } of linksToUpdate) {
      await tx.courseRequirement.update({
        where: { id },
        data: { graduationRequirementId: canonicalId },
      });
    }

    // 3. Delete duplicate requirement records.
    const duplicateIds = Array.from(duplicateToCanonical.keys());
    await tx.graduationRequirement.deleteMany({
      where: { id: { in: duplicateIds } },
    });

    // 4. Rename canonical requirements to their final names.
    for (const [id, name] of canonicalNames) {
      await tx.graduationRequirement.update({ where: { id }, data: { name } });
    }

    // 5. Normalize Course.fulfillsRequirements strings to canonical names.
    const courses = await tx.course.findMany({
      select: { id: true, fulfillsRequirements: true },
    });
    for (const course of courses) {
      const raw = course.fulfillsRequirements;
      const reqs = Array.isArray(raw) ? (raw as string[]) : [];
      const normalized = reqs.map((r) => nameReplacements.get(r) ?? r);
      const unique = [...new Set(normalized)];
      if (JSON.stringify(reqs) !== JSON.stringify(unique)) {
        await tx.course.update({
          where: { id: course.id },
          data: { fulfillsRequirements: unique },
        });
      }
    }
  });

  // Capture after state and verify.
  const afterRequirements = await prisma.graduationRequirement.findMany();
  const afterCourseReqCount = await prisma.courseRequirement.count();
  const afterAnalysis = user ? await summarizeAnalysis(user.id) : null;

  const nameCounts = new Map<string, number>();
  for (const r of afterRequirements) {
    nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1);
  }
  const duplicateNames = Array.from(nameCounts.entries()).filter(
    ([, count]) => count > 1
  );

  const canonicalIdSet = new Set(canonicalNames.keys());
  const missingCanonical = afterRequirements.filter((r) => !canonicalIdSet.has(r.id));
  // Requirements not in the canonical map are non-duplicate policy items kept as-is.

  console.log("\n=== Migration complete ===");
  console.log(`Requirements: ${beforeRequirements.length} -> ${afterRequirements.length}`);
  console.log(`CourseRequirements: ${beforeCourseReqCount} -> ${afterCourseReqCount}`);
  console.log(`Duplicate names remaining: ${duplicateNames.length}`);
  if (duplicateNames.length > 0) {
    console.error(duplicateNames);
  }
  console.log(`Non-canonical requirements kept (policy items): ${missingCanonical.length}`);

  if (beforeAnalysis && afterAnalysis) {
    console.log("\n=== Analysis comparison ===");
    console.log("Before:", beforeAnalysis);
    console.log("After:", afterAnalysis);
    if (beforeAnalysis.totalEarned !== afterAnalysis.totalEarned) {
      console.error("ERROR: totalEarned changed");
      process.exit(1);
    }
    if (beforeAnalysis.totalRequired !== afterAnalysis.totalRequired) {
      // Required totals may change when duplicate requirements are deduplicated.
      // This is expected, but log it for visibility.
      console.log("Note: totalRequired changed due to duplicate deduplication.");
    }
  }

  if (duplicateNames.length > 0) {
    process.exit(1);
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

import { PrismaClient } from "@prisma/client";
import { backfillFulfillsRequirements } from "../src/lib/backfillFulfillsRequirements.js";

const prisma = new PrismaClient();

async function main() {
  const allCourses = await prisma.course.findMany({
    select: { id: true, title: true, fulfillsRequirements: true },
    orderBy: { id: "asc" },
  });

  // -- Before snapshots for reporting ----------------------------------------
  const beforeSnapshots = new Map<number, string[]>();
  for (const c of allCourses) {
    beforeSnapshots.set(c.id, Array.isArray(c.fulfillsRequirements)
      ? c.fulfillsRequirements.filter((r): r is string => typeof r === "string")
      : []);
  }

  const result = await backfillFulfillsRequirements(prisma);

  // -- Report -----------------------------------------------------------------
  console.log("=== BACKFILL REPORT ===");
  console.log(`Total courses examined:     ${allCourses.length}`);
  console.log(`Courses updated:            ${result.updatedCount}`);
  console.log(`Already correct:            ${result.alreadyCorrectCount}`);
  console.log(`Courses with no mappings:   ${result.noMappingCount}`);

  // -- Before / after examples ------------------------------------------------
  let exampleCount = 0;
  for (const c of allCourses) {
    if (exampleCount >= 5) break;
    const before = beforeSnapshots.get(c.id) ?? [];
    if (before.length > 0) continue;
    const after = Array.isArray(c.fulfillsRequirements)
      ? c.fulfillsRequirements.filter((r): r is string => typeof r === "string")
      : [];
    if (after.length === 0) continue;
    console.log(`\n  "${c.title}":`);
    console.log(`    before: ${JSON.stringify(before)}`);
    console.log(`    after:  ${JSON.stringify(after)}`);
    exampleCount++;
  }

  // -- Courses with no mappings ------------------------------------------------
  const noMappingCourses = allCourses.filter((c) => {
    const linked = beforeSnapshots.get(c.id) ?? [];
    const current = Array.isArray(c.fulfillsRequirements)
      ? c.fulfillsRequirements.filter((r): r is string => typeof r === "string")
      : [];
    return linked.length === 0 && current.length === 0;
  });

  if (noMappingCourses.length > 0) {
    console.log(`\nCourses with no graduation requirement mappings (${noMappingCourses.length}):`);
    for (const c of noMappingCourses) {
      console.log(`  #${c.id}: "${c.title}"`);
    }
  }

  // -- Verify final state -----------------------------------------------------
  const withFulfillments = await prisma.course.count({
    where: { fulfillsRequirements: { not: [] } },
  });
  console.log(`\nCourses with non-empty fulfillsRequirements: ${withFulfillments} / ${allCourses.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

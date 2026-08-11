import { PrismaClient } from "@prisma/client";
import { canonicalRequirementName } from "../src/lib/requirementsCleanup.js";

const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.graduationRequirement.findMany({ orderBy: { id: "asc" } });
  console.log("Total GradRequirement rows:", reqs.length);
  for (const r of reqs) {
    const links = await prisma.courseRequirement.count({ where: { graduationRequirementId: r.id } });
    console.log(
      JSON.stringify({
        id: r.id,
        name: r.name,
        canonical: canonicalRequirementName(r.name),
        category: r.category,
        requirementType: r.requirementType,
        requiredValue: r.requiredValue,
        isMeasurable: r.isMeasurable,
        linkCount: links,
      })
    );
  }

  const totalCourses = await prisma.course.count();
  const withJson = await prisma.course.count({ where: { fulfillsRequirements: { not: [] } } });
  const withJoin = await prisma.course.count({ where: { requirements: { some: {} } } });
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      title: true,
      fulfillsRequirements: true,
      attributes: true,
      department: { select: { name: true, division: { select: { name: true } } } },
    },
    orderBy: { id: "asc" },
  });
  console.log("\nTotal courses:", totalCourses, "| with fulfills JSON:", withJson, "| with join links:", withJoin);

  // Which courses have fulfillsRequirements values that do NOT resolve to a grad req in DB?
  const reqNames = new Set(reqs.map((r) => canonicalRequirementName(r.name)));
  const unmatched: { id: number; title: string; division: string | null; fr: string[] }[] = [];
  const emptyFulfills: { id: number; title: string; division: string | null }[] = [];
  for (const c of courses) {
    const fr = Array.isArray(c.fulfillsRequirements) ? c.fulfillsRequirements.filter((x): x is string => typeof x === "string") : [];
    if (fr.length === 0) {
      emptyFulfills.push({ id: c.id, title: c.title, division: c.department?.division?.name ?? null });
      continue;
    }
    const unresolved = fr.filter((f) => !reqNames.has(canonicalRequirementName(f)));
    if (unresolved.length > 0) {
      unmatched.push({ id: c.id, title: c.title, division: c.department?.division?.name ?? null, fr });
    }
  }
  console.log("\nCourses with EMPTY fulfillsRequirements:", emptyFulfills.length);
  const byDiv: Record<string, number> = {};
  for (const c of emptyFulfills) {
    const d = c.division ?? "?";
    byDiv[d] = (byDiv[d] ?? 0) + 1;
  }
  console.log(JSON.stringify(byDiv, null, 1));

  console.log("\nCourses with UNRESOLVED fulfillsRequirements entries:", unmatched.length);
  for (const u of unmatched) {
    console.log(JSON.stringify(u));
  }

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
import { PrismaClient } from "@prisma/client";
import { canonicalRequirementName } from "../src/lib/requirementsCleanup.js";

const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    include: {
      department: { select: { name: true, division: { select: { name: true } } } },
      options: { include: { offerings: true } },
      requirements: { include: { graduationRequirement: true } },
    },
    orderBy: { id: "asc" },
  });

  const DIVISIONS = ["Fine Arts", "CSET", "Applied Arts", "Language Learning", "Multilingual Learning", "Science", "Social Studies"];

  for (const div of DIVISIONS) {
    const list = courses.filter((c) => c.department?.division?.name === div);
    console.log(`\n========== DIVISION: ${div} (${list.length} courses) ==========`);
    const depts = new Set<string>();
    let oneCreditSemester = 0;
    let other = 0;
    const frCounts: Record<string, number> = {};
    const linkTargets: Record<string, number> = {};
    for (const c of list) {
      depts.add(c.department?.name ?? "?");
      const fr = c.fulfillsRequirements;
      const frKey = JSON.stringify(fr ?? []);
      frCounts[frKey] = (frCounts[frKey] ?? 0) + 1;
      for (const l of c.requirements) {
        linkTargets[canonicalRequirementName(l.graduationRequirement.name)] =
          (linkTargets[canonicalRequirementName(l.graduationRequirement.name)] ?? 0) + 1;
      }
      const credits = c.options?.[0]?.offerings?.[0]?.credits ?? c.options?.[0]?.credits ?? c.credits;
      const dur = c.duration;
      if (credits === 1 && dur === 1) oneCreditSemester += 1;
      else other += 1;
    }
    console.log("departments:", Array.from(depts).join(", "));
    console.log("fulfillsRequirements distribution:", JSON.stringify(frCounts));
    console.log("CourseRequirement link targets:", JSON.stringify(linkTargets));
    console.log(`1-credit sem courses: ${oneCreditSemester} | other (multi-credit/duration): ${other}`);
    const sample = list.slice(0, 4).map((c) => ({ title: c.title, department: c.department?.name, credits: c.options?.[0]?.offerings?.[0]?.credits ?? c.credits, duration: c.duration, fr: c.fulfillsRequirements }));
    console.log("sample:", JSON.stringify(sample));
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // -- Algebra 2 AB/BC -- full record
  const a2 = await prisma.course.findFirst({
    where: { title: "Algebra 2 AB/BC" },
    include: {
      department: { include: { division: true } },
      options: { include: { offerings: true } },
      requirements: { include: { graduationRequirement: true } },
    },
  });
  console.log("=== ALGEBRA 2 AB/BC ===");
  console.log(`id:              ${a2?.id}`);
  console.log(`title:           ${a2?.title}`);
  console.log(`importKey:       ${a2?.importKey}`);
  console.log(`sourceReference: ${a2?.sourceReference}`);
  console.log(`department:      ${a2?.department?.name} (id=${a2?.department?.id})`);
  console.log(`division:        ${a2?.department?.division?.name}`);
  console.log(`duration:        ${a2?.duration}`);
  console.log(`fulfillsRequirements (JSON): ${JSON.stringify(a2?.fulfillsRequirements)}`);
  console.log(`CourseRequirement links:     ${a2?.requirements.length}`);
  for (const r of a2?.requirements ?? []) {
    console.log(`  -> gradReq #${r.graduationRequirementId}: "${r.graduationRequirement.name}"`);
  }

  // -- Check which fields differ between old/new data
  console.log("\n=== OLD vs NEW data file for Algebra 2 AB/BC ===");

  // -- Compare graduation requirements in DB vs in data file
  const gradReqs = await prisma.graduationRequirement.findMany({ orderBy: { id: "asc" } });
  console.log(`\nAll GraduationRequirement records: ${gradReqs.length}`);
  const measurable = gradReqs.filter(r => r.requiredValue != null);
  console.log(`Measurable (with requiredValue): ${measurable.length}`);
  for (const r of measurable) {
    const linkCount = await prisma.courseRequirement.count({ where: { graduationRequirementId: r.id } });
    console.log(`  "${r.name}" (id=${r.id}, value=${r.requiredValue}) -> ${linkCount} course links`);
  }

  // -- How many courses have fulfillsRequirements JSON vs CourseRequirement links?
  const withJson = await prisma.course.count({ where: { fulfillsRequirements: { not: [] } } });
  const totalCourses = await prisma.course.count();
  const withJoin = await prisma.course.count({ where: { requirements: { some: {} } } });
  const joinRecs = await prisma.courseRequirement.count();

  console.log(`\n=== COVERAGE ===`);
  console.log(`Total courses:                ${totalCourses}`);
  console.log(`With fulfillsRequirements[]:  ${withJson}`);
  console.log(`With CourseRequirement links: ${withJoin}`);
  console.log(`Total CourseRequirement rows: ${joinRecs}`);

  // -- Show all courses with JSON fulfillments (non-empty)
  console.log(`\nCourses with fulfillsRequirements JSON (${withJson}):`);
  const jsonCourses = await prisma.course.findMany({
    where: { fulfillsRequirements: { not: [] } },
    select: { id: true, title: true, fulfillsRequirements: true },
    orderBy: { id: "asc" },
  });
  for (const c of jsonCourses) {
    console.log(`  #${c.id}: "${c.title}" -> ${JSON.stringify(c.fulfillsRequirements)}`);
  }

  // -- Show courses WITH CourseRequirement links but WITHOUT JSON
  const coursesWithJoinsOnly = await prisma.course.findMany({
    where: { fulfillsRequirements: { equals: [] }, requirements: { some: {} } },
    select: { id: true, title: true },
    orderBy: { id: "asc" },
  });
  console.log(`\nCourses with CourseRequirement links but EMPTY JSON (${coursesWithJoinsOnly.length}):`);
  for (const c of coursesWithJoinsOnly) {
    const links = await prisma.courseRequirement.findMany({
      where: { courseId: c.id },
      include: { graduationRequirement: true },
    });
    const reqs = links.map(l => l.graduationRequirement.name).join(", ");
    console.log(`  #${c.id}: "${c.title}" -> [${reqs}]`);
  }

  // -- Courses WITHOUT either
  const noLinks = await prisma.course.count({
    where: {
      fulfillsRequirements: { equals: [] },
      requirements: { none: {} },
    },
  });
  console.log(`\nCourses with NEITHER: ${noLinks}`);

  // -- Check math courses specifically
  console.log(`\n=== MATH COURSES ===`);
  const mathCourses = await prisma.course.findMany({
    where: { department: { name: "Mathematics" } },
    include: { requirements: { include: { graduationRequirement: true } } },
    orderBy: { id: "asc" },
  });
  for (const c of mathCourses) {
    const json = JSON.stringify(c.fulfillsRequirements);
    const joinReqs = c.requirements.map(r => r.graduationRequirement.name).join(", ");
    console.log(`  #${c.id}: "${c.title}" json=${json} joins=[${joinReqs}]`);
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

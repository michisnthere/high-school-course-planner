import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const courses = await p.summerCourse.findMany({
  include: { sessions: true, regularCourse: { select: { id: true, title: true } } },
  orderBy: { title: "asc" },
});
for (const c of courses) {
  console.log(
    `${c.id} | key=${c.key} | title=${c.title} | code=${c.courseCode ?? ""} | credit=${c.creditStatus}/${c.credits} | sessions=${c.sessions.map((s) => s.session).join(",")} | dur=${c.duration} | only=${c.isSummerOnly} | matched=${c.regularCourse?.id ?? "none"} | matchTitle=${c.matchedTitle ?? ""} | notes=${(c.notes as string[]).length}`
  );
}
console.log("TOTAL", courses.length);
await p.$disconnect();
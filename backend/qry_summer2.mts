import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const keys = [
  "careers-in-business",
  "college-essay-workshop",
  "driver-education",
  "creative-writing",
  "act-preparatory-course",
  "algebra-1",
];
for (const key of keys) {
  const c = await p.summerCourse.findUnique({
    where: { key },
    include: { sessions: true },
  });
  console.log(`\n===== ${key} =====`);
  console.log("title:", c?.title);
  console.log("courseCode:", c?.courseCode);
  console.log("creditStatus:", c?.creditStatus, "credits:", c?.credits);
  console.log("description:", c?.description);
  console.log("gradeLevels:", JSON.stringify(c?.gradeLevels));
  console.log("duration:", c?.duration);
  console.log("prerequisites:", JSON.stringify(c?.prerequisites));
  console.log("corequisites:", JSON.stringify(c?.corequisites));
  console.log("fulfillsRequirements:", JSON.stringify(c?.fulfillsRequirements));
  console.log("notes:", JSON.stringify(c?.notes, null, 2));
  console.log("attributes?: n/a (no column)");
  console.log("sessions:", JSON.stringify(c?.sessions.map((s) => s.session)));
}
await p.$disconnect();
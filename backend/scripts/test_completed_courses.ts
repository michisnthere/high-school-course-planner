import express from "express";
import { prisma } from "../src/lib/prisma.js";
import completedCoursesRouter from "../src/routes/completedCourses.js";

const app = express();
app.use(express.json());

// Attach a test user so requireAuth passes.
app.use((req, _res, next) => {
  (req as any).user = {
    id: 1,
    googleId: "test-google-id",
    email: "test@example.com",
    name: "Test User",
    picture: null,
  };
  (req as any).isAuthenticated = () => true;
  next();
});

app.use("/api/completed-courses", completedCoursesRouter);

async function run() {
  await prisma.user.upsert({
    where: { googleId: "test-google-id" },
    update: {},
    create: {
      googleId: "test-google-id",
      email: "test@example.com",
      name: "Test User",
    },
  });

  // Use any existing course if available, otherwise create a minimal one.
  let course = await prisma.course.findFirst();
  if (!course) {
    const division = await prisma.division.create({
      data: { name: "Test Division" },
    });
    const department = await prisma.department.create({
      data: { name: "Test Department", divisionId: division.id },
    });
    course = await prisma.course.create({
      data: {
        importKey: "test-course-001",
        title: "Test Course",
        departmentId: department.id,
        description: "A test course",
      },
    });
  }

  // Clean up previous test completed courses for this user/course.
  await prisma.completedCourse.deleteMany({
    where: { userId: 1, courseId: course.id },
  });

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(9999, async () => {
      try {
        const base = "http://localhost:9999/api/completed-courses";

        // 1. GET should initially return empty array for this user/course.
        const listRes = await fetch(base);
        if (!listRes.ok) throw new Error(`GET failed: ${listRes.status}`);
        const list = await listRes.json();
        const existing = list.find((cc: any) => cc.courseId === course.id);
        if (existing) throw new Error("Test completed course already exists");
        console.log("GET completed-courses OK (empty or unrelated entries)");

        // 2. POST add a completed course.
        const addRes = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId: course.id,
            gradeCompleted: "Sophomore (10)",
          }),
        });
        if (!addRes.ok) throw new Error(`POST failed: ${addRes.status} ${await addRes.text()}`);
        const added = await addRes.json();
        console.log("POST completed-course OK", {
          id: added.id,
          courseId: added.courseId,
          gradeCompleted: added.gradeCompleted,
          credits: added.credits,
          hasCourseDetails: !!added.course,
        });

        // 3. GET should now include the added course.
        const listAfterRes = await fetch(base);
        if (!listAfterRes.ok) throw new Error(`GET after add failed: ${listAfterRes.status}`);
        const listAfter = await listAfterRes.json();
        const found = listAfter.find((cc: any) => cc.id === added.id);
        if (!found) throw new Error("Added completed course not returned");
        console.log("GET completed-courses after add OK");

        // 4. DELETE the completed course.
        const deleteRes = await fetch(`${base}/${added.id}`, { method: "DELETE" });
        if (!deleteRes.ok) throw new Error(`DELETE failed: ${deleteRes.status}`);
        console.log("DELETE completed-course OK");

        // 5. GET should no longer include it.
        const listFinalRes = await fetch(base);
        if (!listFinalRes.ok) throw new Error(`GET final failed: ${listFinalRes.status}`);
        const listFinal = await listFinalRes.json();
        const stillThere = listFinal.find((cc: any) => cc.id === added.id);
        if (stillThere) throw new Error("Deleted completed course still present");
        console.log("GET final OK (deleted entry gone)");

        console.log("\nAll completed-courses CRUD checks passed.");
        server.close(() => resolve());
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });

  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

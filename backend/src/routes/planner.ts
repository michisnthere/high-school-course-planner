import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const years = [9, 10, 11, 12];

  // Ensure all four yearly planners exist, using upsert so concurrent
  // requests for the same user never violate the unique index.
  await prisma.$transaction(
    years.map((year) =>
      prisma.planner.upsert({
        where: { userId_schoolYear: { userId, schoolYear: year } },
        update: {},
        create: { userId, schoolYear: year },
      })
    )
  );

  const planners = await prisma.planner.findMany({
    where: { userId },
    include: { plannedCourses: true },
    orderBy: { schoolYear: "asc" },
  });

  res.json(
    planners.map((planner) => ({
      id: planner.id,
      schoolYear: planner.schoolYear,
      label: YEAR_LABELS[planner.schoolYear],
      plannedCourses: planner.plannedCourses,
    }))
  );
});

export default router;

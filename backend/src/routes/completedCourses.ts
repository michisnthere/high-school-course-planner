import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function getCourseCredits(
  course: {
    options?: Array<{
      credits?: number | null;
      offerings?: Array<{ credits?: number | null }>;
    }>;
  }
): number | null {
  const option = course.options?.[0];
  if (option?.credits != null) {
    return option.credits;
  }
  const offering = option?.offerings?.[0];
  if (offering?.credits != null) {
    return offering.credits;
  }
  return null;
}

const completedCourseInclude = {
  course: {
    include: {
      department: {
        include: {
          division: true,
        },
      },
      options: {
        include: {
          offerings: true,
        },
      },
    },
  },
} as const;

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const completed = await prisma.completedCourse.findMany({
      where: { userId },
      orderBy: [{ yearTaken: "asc" }, { gradeLevelTaken: "asc" }],
      include: completedCourseInclude,
    });
    res.json(completed);
  } catch (err) {
    console.error("Failed to fetch completed courses:", err);
    res.status(500).json({ error: "Failed to fetch completed courses" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const courseId = Number(req.body.courseId);
  const gradeLevelTaken = Number(req.body.gradeLevelTaken);
  const yearTaken = Number(req.body.yearTaken);
  let credits = req.body.credits != null ? Number(req.body.credits) : undefined;

  if (!courseId || !gradeLevelTaken || !yearTaken) {
    return res.status(400).json({
      error: "courseId, gradeLevelTaken, and yearTaken are required",
    });
  }

  if (gradeLevelTaken < 9 || gradeLevelTaken > 12) {
    return res.status(400).json({
      error: "gradeLevelTaken must be between 9 and 12",
    });
  }

  if (yearTaken < MIN_YEAR || yearTaken > MAX_YEAR) {
    return res.status(400).json({
      error: `yearTaken must be between ${MIN_YEAR} and ${MAX_YEAR}`,
    });
  }

  if (credits != null && Number.isNaN(credits)) {
    credits = undefined;
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        options: {
          include: {
            offerings: true,
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const completed = await prisma.completedCourse.create({
      data: {
        userId,
        courseId,
        gradeLevelTaken,
        yearTaken,
        credits: credits ?? getCourseCredits(course),
      },
      include: completedCourseInclude,
    });
    res.status(201).json(completed);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error: "Course already recorded as completed for this grade and year",
      });
    }
    console.error("Failed to record completed course:", err);
    res.status(500).json({ error: "Failed to record completed course" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  try {
    const existing = await prisma.completedCourse.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Completed course not found" });
    }

    await prisma.completedCourse.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete completed course:", err);
    res.status(500).json({ error: "Failed to delete completed course" });
  }
});

export default router;

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { normalizeRequirementNames } from "../lib/requirementsCleanup.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const courses = await prisma.course.findMany({
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
    });

    res.json(
      courses.map((course) => ({
        ...course,
        fulfillsRequirements: Array.isArray(course.fulfillsRequirements)
          ? normalizeRequirementNames(course.fulfillsRequirements.filter((req): req is string => typeof req === "string"))
          : [],
      }))
    );
    } catch (error) {
    console.error("Failed to fetch courses:", error);
    res.status(500).json({
        error: "Failed to fetch courses",
    });
    }
});

export default router;

import { Router } from "express";
import { prisma } from "../lib/prisma.js";

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

    res.json(courses);
    } catch (error) {
    console.error("Failed to fetch courses:", error);
    res.status(500).json({
        error: String(error),
    });
    }
});

export default router;
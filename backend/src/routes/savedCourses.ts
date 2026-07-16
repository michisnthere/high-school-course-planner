import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const saved = await prisma.savedCourse.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(saved);
}));

router.post("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const courseId = Number(req.body.courseId);

  if (!courseId) {
    return res.status(400).json({ error: "courseId is required" });
  }

  try {
    const saved = await prisma.savedCourse.create({
      data: { userId, courseId },
    });
    res.status(201).json(saved);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Course already saved" });
    }
    console.error("Failed to save course:", err);
    res.status(500).json({ error: "Failed to save course" });
  }
});

router.delete("/:courseId", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const courseId = Number(req.params.courseId);

  if (!courseId) {
    return res.status(400).json({ error: "courseId is required" });
  }

  await prisma.savedCourse.deleteMany({
    where: { userId, courseId },
  });

  res.json({ success: true });
}));

export default router;

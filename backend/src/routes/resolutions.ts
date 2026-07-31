import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { hasDriverEducationCourse } from "../lib/driverEducation.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const resolutions = await prisma.requirementResolution.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(resolutions);
  } catch (err) {
    console.error("Failed to fetch resolutions:", err);
    res.status(500).json({ error: "Failed to fetch resolutions" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { type, courseId, metadata } = req.body;
    if (!type || typeof type !== "string") {
      return res.status(400).json({ error: "type is required" });
    }
    const validTypes = ["pe_waiver", "middle_school", "summer_school", "placement_test", "admin_override"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type: ${type}` });
    }

    if (
      type === "pe_waiver" &&
      (metadata as Record<string, unknown> | null | undefined)?.variant === "driver_ed_external" &&
      (await hasDriverEducationCourse(req.user!.id))
    ) {
      return res.status(409).json({
        error:
          "Driver Education is already in your planner. Remove it before marking it as completed outside of school.",
      });
    }

    const resolution = await prisma.requirementResolution.create({
      data: {
        userId: req.user!.id,
        type,
        courseId: courseId ? Number(courseId) : null,
        metadata: metadata ?? {},
      },
    });
    res.status(201).json(resolution);
  } catch (err) {
    console.error("Failed to create resolution:", err);
    res.status(500).json({ error: "Failed to create resolution" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const resolution = await prisma.requirementResolution.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!resolution || resolution.userId !== req.user!.id) {
      return res.status(404).json({ error: "Resolution not found" });
    }
    await prisma.requirementResolution.delete({ where: { id: resolution.id } });
    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete resolution:", err);
    res.status(500).json({ error: "Failed to delete resolution" });
  }
});

export default router;

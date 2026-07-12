import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { analyzeGpa } from "../lib/gpaAnalysis.js";

const router = Router();

router.get("/projection", requireAuth, async (req, res) => {
  try {
    const result = await analyzeGpa(req.user!.id);
    res.json(result);
  } catch (error) {
    console.error("Failed to compute GPA projection:", error);
    res.status(500).json({ error: "Failed to compute GPA projection" });
  }
});

export default router;

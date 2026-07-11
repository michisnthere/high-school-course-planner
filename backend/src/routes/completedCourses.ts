import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { deriveCourseDetails } from "./planner.js";

const router = Router();

export const GRADE_COMPLETED_OPTIONS = [
  "Middle School",
  "Freshman (9)",
  "Sophomore (10)",
  "Junior (11)",
  "Senior (12)",
] as const;

type GradeCompleted = (typeof GRADE_COMPLETED_OPTIONS)[number];

type CompletedCourseResponse = {
  id: number;
  userId: number;
  courseId: number;
  gradeCompleted: string;
  credits: number | null;
  course: ReturnType<typeof deriveCourseDetails>;
};

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const completed = await prisma.completedCourse.findMany({
    where: { userId },
    include: {
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
    },
    orderBy: { createdAt: "desc" },
  });

  const response: CompletedCourseResponse[] = completed.map((cc) => ({
    id: cc.id,
    userId: cc.userId,
    courseId: cc.courseId,
    gradeCompleted: cc.gradeCompleted,
    credits: cc.credits ?? null,
    course: deriveCourseDetails(cc.course),
  }));

  res.json(response);
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { courseId, gradeCompleted } = req.body;

  if (!courseId || !gradeCompleted) {
    return res.status(400).json({ error: "courseId and gradeCompleted are required" });
  }

  if (!GRADE_COMPLETED_OPTIONS.includes(gradeCompleted)) {
    return res.status(400).json({ error: "Invalid gradeCompleted value" });
  }

  const course = await prisma.course.findUnique({
    where: { id: Number(courseId) },
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

  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }

  const details = deriveCourseDetails(course);

  const existing = await prisma.completedCourse.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  });

  if (existing) {
    return res.status(409).json({ error: "Course already marked as completed" });
  }

  const created = await prisma.completedCourse.create({
    data: {
      userId,
      courseId: course.id,
      gradeCompleted: gradeCompleted as GradeCompleted,
      credits: details.credits,
    },
    include: {
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
    },
  });

  const response: CompletedCourseResponse = {
    id: created.id,
    userId: created.userId,
    courseId: created.courseId,
    gradeCompleted: created.gradeCompleted,
    credits: created.credits ?? null,
    course: deriveCourseDetails(created.course),
  };

  res.status(201).json(response);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "Invalid completed course id" });
  }

  const existing = await prisma.completedCourse.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== userId) {
    return res.status(404).json({ error: "Completed course not found" });
  }

  await prisma.completedCourse.delete({
    where: { id },
  });

  res.json({ success: true });
});

export default router;

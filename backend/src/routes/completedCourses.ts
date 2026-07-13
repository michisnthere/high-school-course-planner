import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { deriveCourseDetails } from "./planner.js";
import { calculateTotalCredits } from "../lib/courseCredits.js";

const router = Router();

export const GRADE_COMPLETED_OPTIONS = [
  "Middle School",
  "Freshman (9)",
  "Sophomore (10)",
  "Junior (11)",
  "Senior (12)",
] as const;

export const LETTER_GRADE_OPTIONS = ["A", "B", "C", "D", "F"] as const;

type GradeCompleted = (typeof GRADE_COMPLETED_OPTIONS)[number];

type CompletedCourseResponse = {
  id: number;
  userId: number;
  courseId: number;
  gradeCompleted: string;
  yearCompleted: string | null;
  letterGrade: string | null;
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
    yearCompleted: cc.yearCompleted ?? null,
    letterGrade: cc.letterGrade ?? null,
    credits: cc.credits ?? null,
    course: deriveCourseDetails(cc.course),
  }));

  res.json(response);
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { courseId, gradeCompleted, yearCompleted, letterGrade } = req.body;

  if (!courseId || !gradeCompleted) {
    return res.status(400).json({ error: "courseId and gradeCompleted are required" });
  }

  if (!GRADE_COMPLETED_OPTIONS.includes(gradeCompleted)) {
    return res.status(400).json({ error: "Invalid gradeCompleted value" });
  }

  if (letterGrade != null && !LETTER_GRADE_OPTIONS.includes(letterGrade)) {
    return res.status(400).json({ error: "Invalid letterGrade value" });
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

  const calculatedCredits = calculateTotalCredits(course);

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
      yearCompleted: yearCompleted ?? null,
      letterGrade: letterGrade ?? null,
      credits: calculatedCredits,
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
    yearCompleted: created.yearCompleted ?? null,
    letterGrade: created.letterGrade ?? null,
    credits: created.credits ?? null,
    course: deriveCourseDetails(created.course),
  };

  res.status(201).json(response);
});

router.put("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "Invalid completed course id" });
  }

  const existing = await prisma.completedCourse.findUnique({
    where: { id },
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

  if (!existing || existing.userId !== userId) {
    return res.status(404).json({ error: "Completed course not found" });
  }

  const { letterGrade, gradeCompleted, yearCompleted } = req.body;

  if (letterGrade != null && !LETTER_GRADE_OPTIONS.includes(letterGrade)) {
    return res.status(400).json({ error: "Invalid letterGrade value" });
  }

  if (gradeCompleted != null && !GRADE_COMPLETED_OPTIONS.includes(gradeCompleted)) {
    return res.status(400).json({ error: "Invalid gradeCompleted value" });
  }

  const updated = await prisma.completedCourse.update({
    where: { id },
    data: {
      ...(letterGrade !== undefined ? { letterGrade: letterGrade ?? null } : {}),
      ...(gradeCompleted !== undefined ? { gradeCompleted: gradeCompleted as GradeCompleted } : {}),
      ...(yearCompleted !== undefined ? { yearCompleted: yearCompleted ?? null } : {}),
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
    id: updated.id,
    userId: updated.userId,
    courseId: updated.courseId,
    gradeCompleted: updated.gradeCompleted,
    yearCompleted: updated.yearCompleted ?? null,
    letterGrade: updated.letterGrade ?? null,
    credits: updated.credits ?? null,
    course: deriveCourseDetails(updated.course),
  };

  res.json(response);
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

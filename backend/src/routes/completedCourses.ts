import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { deriveCourseDetails } from "../lib/courseDetails.js";
import { deriveSummerCourseDetails } from "../lib/summerCourseDetails.js";
import { calculateTotalCredits } from "../lib/courseCredits.js";
import { courseFulfillsDriverEducation, hasDriverEdExternalResolution } from "../lib/driverEducation.js";
import {
  isRepeatableOneSemesterPe,
  findSummerEquivalentPlanned,
  findSummerEquivalentCompleted,
  findRegularEquivalentPlanned,
  findRegularEquivalentCompleted,
} from "../lib/summerDuplicateGuard.js";

const router = Router();

export const GRADE_COMPLETED_OPTIONS = [
  "Middle School",
  "Middle School Summer",
  "Summer School",
  "Freshman (9)",
  "Freshman Summer",
  "Sophomore (10)",
  "Sophomore Summer",
  "Junior (11)",
  "Junior Summer",
  "Senior (12)",
  "Senior Summer",
] as const;

export const LETTER_GRADE_OPTIONS = ["A", "B", "C", "D", "F"] as const;

type GradeCompleted = (typeof GRADE_COMPLETED_OPTIONS)[number];

/** gradeCompleted values that represent summer work (mirrors the frontend SUMMER_GRADES set). */
const SUMMER_GRADE_COMPLETED_OPTIONS: ReadonlySet<GradeCompleted> = new Set<GradeCompleted>([
  "Middle School Summer",
  "Freshman Summer",
  "Sophomore Summer",
  "Junior Summer",
  "Senior Summer",
  "Summer School",
]);

function isSummerGrade(grade: string): boolean {
  return SUMMER_GRADE_COMPLETED_OPTIONS.has(grade as GradeCompleted);
}

type CompletedCourseResponse = {
  id: number;
  userId: number;
  courseId: number | null;
  summerCourseId: number | null;
  gradeCompleted: string;
  letterGrade: string | null;
  credits: number | null;
  course: ReturnType<typeof deriveCourseDetails> | null;
  summerCourse: ReturnType<typeof deriveSummerCourseDetails> | null;
};

router.get("/", requireAuth, asyncHandler(async (req, res) => {
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
      summerCourse: {
          include: {
            regularCourse: {
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
        },
    },
    orderBy: { createdAt: "desc" },
  });

  const response: CompletedCourseResponse[] = completed.map((cc) => ({
    id: cc.id,
    userId: cc.userId,
    courseId: cc.courseId,
    summerCourseId: cc.summerCourseId,
    gradeCompleted: cc.gradeCompleted,
    letterGrade: cc.letterGrade ?? null,
    credits: cc.credits ?? null,
    course: cc.course ? deriveCourseDetails(cc.course) : null,
    summerCourse: cc.summerCourse ? deriveSummerCourseDetails(cc.summerCourse) : null,
  }));

  res.json(response);
}));

router.post("/", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { courseId, summerCourseId, gradeCompleted, letterGrade } = req.body;

  if ((!courseId && !summerCourseId) || !gradeCompleted) {
    return res
      .status(400)
      .json({ error: "courseId (or summerCourseId) and gradeCompleted are required" });
  }

  if (!GRADE_COMPLETED_OPTIONS.includes(gradeCompleted)) {
    return res.status(400).json({ error: "Invalid gradeCompleted value" });
  }

  if (letterGrade != null && !LETTER_GRADE_OPTIONS.includes(letterGrade)) {
    return res.status(400).json({ error: "Invalid letterGrade value" });
  }

  if (courseId) {
    // A regular course must be recorded in a regular period; the two context
    // sets must never be mixed.
    if (isSummerGrade(gradeCompleted)) {
      return res.status(400).json({ error: "Regular courses cannot be marked completed in a Summer-specific period." });
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

    if (courseFulfillsDriverEducation(course) && (await hasDriverEdExternalResolution(userId))) {
      return res.status(409).json({
        error:
          "Driver Education is already marked as completed outside of school. Undo that first to mark it as a completed course.",
      });
    }

    const calculatedCredits = calculateTotalCredits(course);

    const existing = await prisma.completedCourse.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
    });

    if (existing) {
      return res.status(409).json({ error: "Course already marked as completed" });
    }

    // The Summer School equivalent of a regular course is the same course
    // attempt. Block recording the regular course as completed when its summer
    // equivalent is already completed or planned (unless repeatable one-sem PE).
    if (!isRepeatableOneSemesterPe(course)) {
      const summerEquivalentCompleted = await findSummerEquivalentCompleted(userId, course.id);
      if (summerEquivalentCompleted) {
        return res.status(409).json({ error: "You have already completed the Summer School equivalent of this course." });
      }
      const summerEquivalentPlanned = await findSummerEquivalentPlanned(userId, course.id);
      if (summerEquivalentPlanned) {
        return res.status(409).json({ error: "The Summer School equivalent of this course is already planned in your schedule." });
      }
    }

    const created = await prisma.completedCourse.create({
      data: {
        userId,
        courseId: course.id,
        gradeCompleted: gradeCompleted as GradeCompleted,
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
        summerCourse: {
          include: {
            regularCourse: {
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
        },
      },
    });

    const response: CompletedCourseResponse = {
      id: created.id,
      userId: created.userId,
      courseId: created.courseId,
      summerCourseId: created.summerCourseId,
      gradeCompleted: created.gradeCompleted,
      letterGrade: created.letterGrade ?? null,
      credits: created.credits ?? null,
      course: created.course ? deriveCourseDetails(created.course) : null,
      summerCourse: created.summerCourse ? deriveSummerCourseDetails(created.summerCourse) : null,
    };

    return res.status(201).json(response);
  }

  if (summerCourseId) {
    // A Summer School course must be recorded in a Summer-specific period.
    if (!isSummerGrade(gradeCompleted)) {
      return res.status(400).json({ error: "Summer School courses must be marked completed in a Summer-specific period." });
    }
    const summer = await prisma.summerCourse.findUnique({
      where: { id: Number(summerCourseId) },
      include: {
        regularCourse: {
          include: {
            department: {
              include: {
                division: true,
              },
            },
          },
        },
      },
    });

    if (!summer) {
      return res.status(404).json({ error: "Summer course not found" });
    }

    const existing = await prisma.completedCourse.findFirst({
      where: { userId, summerCourseId: summer.id },
    });

    if (existing) {
      return res.status(409).json({ error: "Course already marked as completed" });
    }

    // The Summer School course is the same course attempt as its matched
    // regular equivalent. Block when the regular equivalent is already
    // completed or planned (unless repeatable one-semester PE).
    const regularEquivalent = summer.regularCourse;
    if (regularEquivalent && !isRepeatableOneSemesterPe(regularEquivalent)) {
      const completedRegular = await findRegularEquivalentCompleted(userId, regularEquivalent.id);
      if (completedRegular) {
        return res.status(409).json({ error: "You have already completed this course (regular equivalent)." });
      }
      const plannedRegular = await findRegularEquivalentPlanned(userId, regularEquivalent.id);
      if (plannedRegular) {
        return res.status(409).json({ error: "This course is already planned in your schedule (regular equivalent)." });
      }
    }

    const created = await prisma.completedCourse.create({
      data: {
        userId,
        summerCourseId: summer.id,
        gradeCompleted: gradeCompleted as GradeCompleted,
        letterGrade: letterGrade ?? null,
        credits: summer.credits,
      },
      include: {
        summerCourse: {
          include: {
            regularCourse: {
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
        },
      },
    });

    const response: CompletedCourseResponse = {
      id: created.id,
      userId: created.userId,
      courseId: null,
      summerCourseId: created.summerCourseId,
      gradeCompleted: created.gradeCompleted,
      letterGrade: created.letterGrade ?? null,
      credits: created.credits ?? null,
      course: null,
      summerCourse: created.summerCourse ? deriveSummerCourseDetails(created.summerCourse) : null,
    };

    return res.status(201).json(response);
  }
}));

router.put("/:id", requireAuth, asyncHandler(async (req, res) => {
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
      summerCourse: {
          include: {
            regularCourse: {
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
        },
    },
  });

  if (!existing || existing.userId !== userId) {
    return res.status(404).json({ error: "Completed course not found" });
  }

  const { letterGrade, gradeCompleted } = req.body;

  if (letterGrade != null && !LETTER_GRADE_OPTIONS.includes(letterGrade)) {
    return res.status(400).json({ error: "Invalid letterGrade value" });
  }

  if (gradeCompleted != null && !GRADE_COMPLETED_OPTIONS.includes(gradeCompleted)) {
    return res.status(400).json({ error: "Invalid gradeCompleted value" });
  }

  // The edited record must keep a period that matches its course context.
  if (gradeCompleted != null) {
    const isSummerContext = existing.summerCourseId != null;
    if (isSummerGrade(gradeCompleted) !== isSummerContext) {
      return res.status(400).json({
        error: isSummerContext
          ? "Summer School courses must keep a Summer-specific period."
          : "Regular courses cannot be marked completed in a Summer-specific period.",
      });
    }
  }

  const updated = await prisma.completedCourse.update({
    where: { id },
    data: {
      ...(letterGrade !== undefined ? { letterGrade: letterGrade ?? null } : {}),
      ...(gradeCompleted !== undefined ? { gradeCompleted: gradeCompleted as GradeCompleted } : {}),
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
      summerCourse: {
          include: {
            regularCourse: {
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
        },
    },
  });

  const response: CompletedCourseResponse = {
    id: updated.id,
    userId: updated.userId,
    courseId: updated.courseId,
    summerCourseId: updated.summerCourseId,
    gradeCompleted: updated.gradeCompleted,
    letterGrade: updated.letterGrade ?? null,
    credits: updated.credits ?? null,
    course: updated.course ? deriveCourseDetails(updated.course) : null,
    summerCourse: updated.summerCourse ? deriveSummerCourseDetails(updated.summerCourse) : null,
  };

  res.json(response);
}));

router.delete("/:id", requireAuth, asyncHandler(async (req, res) => {
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
}));

export default router;

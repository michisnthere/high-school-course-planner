import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import type { Course, PlannerOption } from "@prisma/client";

const router = Router();

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

type CourseDetails = {
  id: number;
  title: string;
  normalizedTitle: string | null;
  duration: number;
  creditType: string | null;
  credits: number | null;
  division: string | null;
  department: string | null;
  description: string | null;
  fulfillsRequirements: string[];
  prerequisites: string[];
  courseCode: string | null;
};

type PlannedCourseResponse = {
  id: number;
  plannerId: number;
  courseId: number | null;
  plannerOptionId: number | null;
  semester: number;
  slot: number;
  course: CourseDetails;
};

type PlannerResponse = {
  id: number;
  schoolYear: number;
  label: string;
  plannedCourses: PlannedCourseResponse[];
};

function normalizeDuration(value: unknown): number {
  if (typeof value === "number" && value === 2) {
    return 2;
  }
  if (typeof value === "string") {
    const num = Number(value.trim());
    return num === 2 ? 2 : 1;
  }
  return 1;
}

function deriveCourseDuration(
  course: Course & {
    duration?: number | null;
    options?: Array<{ offerings?: Array<{ duration?: string | number | null }> }>;
  }
): number {
  if (course.duration === 2) {
    return 2;
  }
  if (course.duration === 1) {
    return 1;
  }

  const durations =
    course.options?.flatMap((option) => option.offerings?.map((offering) => offering.duration) ?? []) ?? [];

  return durations.some((duration) => normalizeDuration(duration) === 2) ? 2 : 1;
}

function deriveCourseDetails(
  course: Course & {
    department?: { name: string; division?: { name: string } | null } | null;
    options?: Array<{
      creditType?: string | null;
      credits?: number | null;
      offerings?: Array<{
        duration?: string | number | null;
        courseCode?: string | null;
        prerequisites?: unknown;
      }>;
    }>;
  }
): CourseDetails {
  const option = course.options?.[0];
  const offerings = option?.offerings ?? [];

  const prerequisites = new Set<string>();
  for (const offering of offerings) {
    if (Array.isArray(offering.prerequisites)) {
      for (const item of offering.prerequisites) {
        if (typeof item === "string" && item.trim()) {
          prerequisites.add(item.trim());
        }
      }
    }
  }

  let courseCode: string | null = null;
  for (const offering of offerings) {
    if (typeof offering.courseCode === "string" && offering.courseCode) {
      courseCode = offering.courseCode;
      break;
    }
  }

  return {
    id: course.id,
    title: course.title,
    normalizedTitle: course.normalizedTitle ?? null,
    duration: deriveCourseDuration(course),
    creditType: option?.creditType ?? null,
    credits: option?.credits ?? null,
    division: course.department?.division?.name ?? null,
    department: course.department?.name ?? null,
    description: course.description ?? null,
    fulfillsRequirements: Array.isArray(course.fulfillsRequirements) ? course.fulfillsRequirements.filter((r): r is string => typeof r === "string") : [],
    prerequisites: Array.from(prerequisites),
    courseCode,
  };
}

function derivePlannerOptionDetails(option: PlannerOption): CourseDetails {
  return {
    id: -option.id,
    title: option.name,
    normalizedTitle: null,
    duration: option.duration,
    creditType: null,
    credits: option.credits,
    division: null,
    department: null,
    description: null,
    fulfillsRequirements: [],
    prerequisites: [],
    courseCode: null,
  };
}

function getPlannedDuration(plannedCourse: {
  course: (Course & { options?: Array<{ offerings?: Array<{ duration?: string | number | null }> }> }) | null;
  plannerOption: PlannerOption | null;
}): number {
  if (plannedCourse.course) {
    return deriveCourseDuration(plannedCourse.course);
  }
  return plannedCourse.plannerOption?.duration ?? 1;
}

function serializePlannedCourse(plannedCourse: {
  id: number;
  plannerId: number;
  courseId: number | null;
  plannerOptionId: number | null;
  semester: number;
  slot: number;
  course: (Course & { options?: Array<{ creditType?: string | null; credits?: number | null; offerings?: Array<{ duration?: string | null }> }> }) | null;
  plannerOption: PlannerOption | null;
}): PlannedCourseResponse {
  return {
    id: plannedCourse.id,
    plannerId: plannedCourse.plannerId,
    courseId: plannedCourse.courseId,
    plannerOptionId: plannedCourse.plannerOptionId,
    semester: plannedCourse.semester,
    slot: plannedCourse.slot,
    course: plannedCourse.course
      ? deriveCourseDetails(plannedCourse.course)
      : derivePlannerOptionDetails(plannedCourse.plannerOption!),
  };
}

async function getPlannerResponse(plannerId: number): Promise<PlannerResponse> {
  const planner = await prisma.planner.findUnique({
    where: { id: plannerId },
    include: {
      plannedCourses: {
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
          plannerOption: true,
        },
      },
    },
  });

  if (!planner) {
    throw new Error("Planner not found");
  }

  return {
    id: planner.id,
    schoolYear: planner.schoolYear,
    label: YEAR_LABELS[planner.schoolYear],
    plannedCourses: planner.plannedCourses.map(serializePlannedCourse),
  };
}

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const years = [9, 10, 11, 12];

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
    include: {
      plannedCourses: {
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
          plannerOption: true,
        },
      },
    },
    orderBy: { schoolYear: "asc" },
  });

  const response: PlannerResponse[] = planners.map((planner) => ({
    id: planner.id,
    schoolYear: planner.schoolYear,
    label: YEAR_LABELS[planner.schoolYear],
    plannedCourses: planner.plannedCourses.map(serializePlannedCourse),
  }));

  res.json(response);
});

router.get("/courses", requireAuth, async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const courses = await prisma.course.findMany({
    where: search
      ? {
          title: { contains: search, mode: "insensitive" },
        }
      : undefined,
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
    orderBy: { title: "asc" },
    take: 50,
  });

  const response: CourseDetails[] = courses.map(deriveCourseDetails);
  res.json(response);
});

router.get("/options", requireAuth, async (req, res) => {
  const grade = Number(req.query.grade);

  const options = await prisma.plannerOption.findMany({
    where: Number.isFinite(grade) ? { availableGrades: { has: grade } } : {},
    orderBy: { name: "asc" },
  });

  res.json(options);
});

router.post("/courses", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { plannerId, courseId, plannerOptionId, semester, slot } = req.body;

  if (!plannerId || (!courseId && !plannerOptionId) || semester == null || slot == null) {
    return res.status(400).json({ error: "plannerId, one of courseId or plannerOptionId, semester, and slot are required" });
  }

  if (courseId && plannerOptionId) {
    return res.status(400).json({ error: "Cannot provide both courseId and plannerOptionId" });
  }

  const semesterNum = Number(semester);
  const slotNum = Number(slot);

  if (semesterNum < 1 || semesterNum > 2) {
    return res.status(400).json({ error: "semester must be 1 or 2" });
  }

  if (slotNum < 1 || slotNum > 7) {
    return res.status(400).json({ error: "slot must be between 1 and 7" });
  }

  const planner = await prisma.planner.findUnique({
    where: { id: Number(plannerId) },
  });

  if (!planner || planner.userId !== userId) {
    return res.status(404).json({ error: "Planner not found" });
  }

  let duration: number;
  let createData: { plannerId: number; courseId?: number; plannerOptionId?: number; semester: number; slot: number };

  if (courseId) {
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

    duration = deriveCourseDuration(course);
    createData = { plannerId: planner.id, courseId: course.id, semester: semesterNum, slot: slotNum };
  } else {
    const option = await prisma.plannerOption.findUnique({
      where: { id: Number(plannerOptionId) },
    });

    if (!option) {
      return res.status(404).json({ error: "Planner option not found" });
    }

    if (!option.availableGrades.includes(planner.schoolYear)) {
      return res.status(409).json({ error: `${option.name} is not available for grade ${planner.schoolYear}` });
    }

    const existingCount = await prisma.plannedCourse.count({
      where: { plannerId: planner.id, plannerOptionId: option.id },
    });

    if (option.maxPerYear != null && existingCount >= option.maxPerYear) {
      return res.status(409).json({
        error: `You can only add ${option.name} ${option.maxPerYear} time${option.maxPerYear === 1 ? "" : "s"} per year`,
      });
    }

    duration = option.duration;
    createData = { plannerId: planner.id, plannerOptionId: option.id, semester: semesterNum, slot: slotNum };
  }

  const targetSemesters = duration === 2 ? [1, 2] : [semesterNum];

  const occupied = await prisma.plannedCourse.findMany({
    where: {
      plannerId: planner.id,
      semester: { in: targetSemesters },
      slot: slotNum,
    },
  });

  if (occupied.length > 0) {
    return res.status(409).json({ error: "Slot is already occupied" });
  }

  const created = await prisma.$transaction(
    targetSemesters.map((sem) =>
      prisma.plannedCourse.create({
        data: { ...createData, semester: sem },
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
          plannerOption: true,
        },
      })
    )
  );

  res.status(201).json(created.map(serializePlannedCourse));
});

router.delete("/courses/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const plannedCourseId = Number(req.params.id);

  if (!plannedCourseId) {
    return res.status(400).json({ error: "Invalid planned course id" });
  }

  const plannedCourse = await prisma.plannedCourse.findUnique({
    where: { id: plannedCourseId },
    include: {
      planner: true,
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
      plannerOption: true,
    },
  });

  if (!plannedCourse || plannedCourse.planner.userId !== userId) {
    return res.status(404).json({ error: "Planned course not found" });
  }

  const duration = getPlannedDuration(plannedCourse);

  if (duration === 2 && plannedCourse.courseId) {
    // Full-year courses are stored as two PlannedCourse records (one per semester).
    // Deleting one deletes the whole course; deleteMany is safe and idempotent.
    await prisma.plannedCourse.deleteMany({
      where: {
        plannerId: plannedCourse.plannerId,
        courseId: plannedCourse.courseId,
        slot: plannedCourse.slot,
      },
    });
  } else if (duration === 2 && plannedCourse.plannerOptionId) {
    await prisma.plannedCourse.deleteMany({
      where: {
        plannerId: plannedCourse.plannerId,
        plannerOptionId: plannedCourse.plannerOptionId,
        slot: plannedCourse.slot,
      },
    });
  } else {
    // deleteMany will not throw if the record was already removed, so repeated
    // deletes are idempotent and race conditions do not crash the server.
    await prisma.plannedCourse.deleteMany({
      where: {
        id: plannedCourseId,
        planner: { userId },
      },
    });
  }

  res.status(204).send();
});

router.post("/courses/:id/move", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const plannedCourseId = Number(req.params.id);
  const { semester, slot } = req.body;

  if (!plannedCourseId) {
    return res.status(400).json({ error: "Invalid planned course id" });
  }

  const semesterNum = Number(semester);
  const slotNum = Number(slot);

  if (Number.isNaN(semesterNum) || semesterNum < 1 || semesterNum > 2) {
    return res.status(400).json({ error: "semester must be 1 or 2" });
  }

  if (Number.isNaN(slotNum) || slotNum < 1 || slotNum > 7) {
    return res.status(400).json({ error: "slot must be between 1 and 7" });
  }

  const source = await prisma.plannedCourse.findUnique({
    where: { id: plannedCourseId },
    include: {
      planner: true,
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
      plannerOption: true,
    },
  });

  if (!source || source.planner.userId !== userId) {
    return res.status(404).json({ error: "Planned course not found" });
  }

  const sourceDuration = getPlannedDuration(source);
  const sourceSemesters = sourceDuration === 2 ? [1, 2] : [source.semester];
  const targetSemesters = sourceDuration === 2 ? [1, 2] : [semesterNum];

  const targets = await prisma.plannedCourse.findMany({
    where: {
      plannerId: source.plannerId,
      semester: { in: targetSemesters },
      slot: slotNum,
    },
    include: {
      course: {
        include: {
          options: {
            include: {
              offerings: true,
            },
          },
        },
      },
      plannerOption: true,
    },
  });

  const TEMP_SLOT = 0;

  if (sourceDuration === 2) {
    if (targets.length === 0) {
      await prisma.plannedCourse.updateMany({
        where: {
          plannerId: source.plannerId,
          courseId: source.courseId,
          slot: source.slot,
        },
        data: { slot: slotNum },
      });
      return res.json(await getPlannerResponse(source.plannerId));
    }

    const allSameCourse = targets.length === 2 && targets.every((t) => t.courseId === targets[0].courseId);
    if (allSameCourse) {
      const targetDuration = getPlannedDuration(targets[0]);
      if (targetDuration === 2) {
        const targetCourseId = targets[0].courseId;
        await prisma.$transaction([
          prisma.plannedCourse.updateMany({
            where: {
              plannerId: source.plannerId,
              courseId: source.courseId,
              slot: source.slot,
            },
            data: { slot: TEMP_SLOT },
          }),
          prisma.plannedCourse.updateMany({
            where: {
              plannerId: source.plannerId,
              courseId: targetCourseId,
              slot: slotNum,
            },
            data: { slot: source.slot },
          }),
          prisma.plannedCourse.updateMany({
            where: {
              plannerId: source.plannerId,
              courseId: source.courseId,
              slot: TEMP_SLOT,
            },
            data: { slot: slotNum },
          }),
        ]);
        return res.json(await getPlannerResponse(source.plannerId));
      }
    }

    return res.status(409).json({
      error: "Cannot move a full-year course to a slot occupied by a course that cannot be swapped.",
    });
  }

  // Source is one-semester.
  const target = targets.find((t) => t.semester === semesterNum);

  if (!target) {
    await prisma.plannedCourse.update({
      where: { id: source.id },
      data: { semester: semesterNum, slot: slotNum },
    });
    return res.json(await getPlannerResponse(source.plannerId));
  }

  const targetDuration = getPlannedDuration(target);
  if (targetDuration === 2) {
    return res.status(409).json({
      error: "Cannot swap a one-semester course with a full-year course.",
    });
  }

  // Swap two one-semester items. Use a temporary slot to avoid unique-constraint conflicts.
  await prisma.$transaction([
    prisma.plannedCourse.update({
      where: { id: source.id },
      data: { slot: TEMP_SLOT },
    }),
    prisma.plannedCourse.update({
      where: { id: target.id },
      data: { semester: source.semester, slot: source.slot },
    }),
    prisma.plannedCourse.update({
      where: { id: source.id },
      data: { semester: semesterNum, slot: slotNum },
    }),
  ]);

  res.json(await getPlannerResponse(source.plannerId));
});

export default router;

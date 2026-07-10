import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import type { Course } from "@prisma/client";

const router = Router();

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

type CourseDuration = "Full Year" | "One Semester";

type CourseDetails = {
  id: number;
  title: string;
  duration: CourseDuration;
  creditType: string | null;
  credits: number | null;
};

type PlannedCourseResponse = {
  id: number;
  plannerId: number;
  courseId: number;
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

function deriveCourseDuration(course: Course & { options?: Array<{ offerings?: Array<{ duration?: string | null }> }> }): CourseDuration {
  const durations =
    course.options?.flatMap((option) => option.offerings?.map((offering) => offering.duration) ?? []) ?? [];

  const hasFullYear = durations.some(
    (duration) => typeof duration === "string" && duration.toLowerCase().includes("full year")
  );

  return hasFullYear ? "Full Year" : "One Semester";
}

function deriveCourseDetails(
  course: Course & { options?: Array<{ creditType?: string | null; credits?: number | null; offerings?: Array<{ duration?: string | null }> }> }
): CourseDetails {
  const option = course.options?.[0];
  return {
    id: course.id,
    title: course.title,
    duration: deriveCourseDuration(course),
    creditType: option?.creditType ?? null,
    credits: option?.credits ?? null,
  };
}

function serializePlannedCourse(plannedCourse: {
  id: number;
  plannerId: number;
  courseId: number;
  semester: number;
  slot: number;
  course: Course & { options?: Array<{ creditType?: string | null; credits?: number | null; offerings?: Array<{ duration?: string | null }> }> };
}): PlannedCourseResponse {
  return {
    id: plannedCourse.id,
    plannerId: plannedCourse.plannerId,
    courseId: plannedCourse.courseId,
    semester: plannedCourse.semester,
    slot: plannedCourse.slot,
    course: deriveCourseDetails(plannedCourse.course),
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

router.post("/courses", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { plannerId, courseId, semester, slot } = req.body;

  if (!plannerId || !courseId || !semester || !slot) {
    return res.status(400).json({ error: "plannerId, courseId, semester, and slot are required" });
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

  const course = await prisma.course.findUnique({
    where: { id: Number(courseId) },
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

  const duration = deriveCourseDuration(course);

  const targetSemesters = duration === "Full Year" ? [1, 2] : [semesterNum];

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
        data: {
          plannerId: planner.id,
          courseId: course.id,
          semester: sem,
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
          options: {
            include: {
              offerings: true,
            },
          },
        },
      },
    },
  });

  if (!plannedCourse || plannedCourse.planner.userId !== userId) {
    return res.status(404).json({ error: "Planned course not found" });
  }

  const duration = deriveCourseDuration(plannedCourse.course);

  if (duration === "Full Year") {
    await prisma.plannedCourse.deleteMany({
      where: {
        plannerId: plannedCourse.plannerId,
        courseId: plannedCourse.courseId,
        slot: plannedCourse.slot,
      },
    });
  } else {
    await prisma.plannedCourse.delete({
      where: { id: plannedCourseId },
    });
  }

  res.json({ success: true });
});

export default router;

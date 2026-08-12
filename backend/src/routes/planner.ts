import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { deriveCourseDuration, calculateTotalCredits, effectiveSlotsPerSemester, isOnePointFivePeriodScienceCourse } from "../lib/courseCredits.js";
import { courseFulfillsDriverEducation, hasDriverEdExternalResolution } from "../lib/driverEducation.js";
import { deriveSummerCourseDetails } from "../lib/summerCourseDetails.js";
import { deriveCourseDetails, type CourseDetails } from "../lib/courseDetails.js";
import {
  isRepeatableOneSemesterPe,
  findSummerEquivalentPlanned,
  findSummerEquivalentCompleted,
  findRegularEquivalentPlanned,
  findRegularEquivalentCompleted,
} from "../lib/summerDuplicateGuard.js";
import type { Course, PlannerOption, SummerCourse } from "@prisma/client";

const router = Router();

// SummerCourse analysis ids live in a deterministic negative namespace so they
// never collide with regular course ids. Mirrors the frontend engine.
const SUMMER_ID_OFFSET = 10000;

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

type PlannedCourseResponse = {
  id: number;
  plannerId: number;
  courseId: number | null;
  summerCourseId: number | null;
  plannerOptionId: number | null;
  semester: number;
  slot: number;
  slotSpan: number;
  course: CourseDetails;
  summerCourse: ReturnType<typeof deriveSummerCourseDetails> | null;
  isEarlyBird: boolean;
};

type PlannerResponse = {
  id: number;
  schoolYear: number;
  label: string;
  completedAt: Date | null;
  plannedCourses: PlannedCourseResponse[];
};

function derivePlannerOptionDetails(option: PlannerOption): CourseDetails {
  return {
    id: -option.id,
    title: option.name,
    normalizedTitle: null,
    duration: option.duration,
    slotsPerSemester: 1,
    creditType: null,
    credits: option.credits,
    division: null,
    department: null,
    description: null,
    fulfillsRequirements: [],
    prerequisites: [],
    courseCode: null,
    courseCodeS1: null,
    courseCodeS2: null,
    gradeMin: null,
    gradeMax: null,
    isNonAcademic: option.isNonAcademic ?? false,
    isMarchingBand: false,
    supportsEarlyBird: false,
    isRepeatable: false,
    isOnline: false,
  };
}

function isRepeatableEligibleCourse(
  course: Course & { department?: { name?: string | null } | null }
): boolean {
  return (
    course.isRepeatable === true &&
    deriveCourseDuration(course) === 1 &&
    course.department?.name === "Physical Education"
  );
}

function getPlannedDuration(plannedCourse: {
  course: (Course & { options?: Array<{ offerings?: Array<{ duration?: string | number | null }> }> }) | null;
  plannerOption: PlannerOption | null;
  summerCourse?: { duration?: string | null } | null;
}): number {
  if (plannedCourse.course) {
    return deriveCourseDuration(plannedCourse.course);
  }
  if (plannedCourse.summerCourse) {
    return plannedCourse.summerCourse.duration === "full_summer" ? 2 : 1;
  }
  return plannedCourse.plannerOption?.duration ?? 1;
}

function getOccupiedSlotCount(plannedCourse: {
  slotSpan?: number;
  course: (Course & { slotsPerSemester?: number | null; options?: Array<{ offerings?: Array<{ duration?: string | number | null }> }> }) | null;
  plannerOption: PlannerOption | null;
}): number {
  // 1.5-period science courses always occupy a single slot regardless of any
  // persisted slotSpan/slotsPerSemester value.
  if (plannedCourse.course && isOnePointFivePeriodScienceCourse(plannedCourse.course)) return 1;
  // Prefer the explicit slotSpan on the PlannedCourse record; fall back to course metadata.
  if (plannedCourse.slotSpan != null && plannedCourse.slotSpan >= 1) return plannedCourse.slotSpan;
  if (plannedCourse.course) {
    return plannedCourse.course.slotsPerSemester ?? 1;
  }
  return 1;
}

function rangesOverlap(slotA: number, spanA: number, slotB: number, spanB: number): boolean {
  return slotA < slotB + spanB && slotB < slotA + spanA;
}

function getLogicalCourseWhere(plannedCourse: {
  plannerId: number;
  courseId: number | null;
  summerCourseId: number | null;
  plannerOptionId: number | null;
}) {
  if (plannedCourse.courseId != null) {
    return { plannerId: plannedCourse.plannerId, courseId: plannedCourse.courseId };
  }
  if (plannedCourse.summerCourseId != null) {
    return {
      plannerId: plannedCourse.plannerId,
      summerCourseId: plannedCourse.summerCourseId,
    };
  }
  return { plannerId: plannedCourse.plannerId, plannerOptionId: plannedCourse.plannerOptionId };
}

/** Full-year block partner for an out-of-semester semester code. 3<->4, 5<->6. */
function outOfSemesterBlock(semester: number): number[] {
  return semester === 3 || semester === 4 ? [3, 4] : [5, 6];
}

function hasConsecutiveFreeSlots(
  existingCourses: Array<{
    id: number;
    semester: number;
    slot: number;
    slotSpan?: number;
    course: (Course & { slotsPerSemester?: number | null; options?: Array<{ offerings?: Array<{ duration?: string | number | null }> }> }) | null;
    plannerOption: PlannerOption | null;
  }>,
  semester: number,
  startSlot: number,
  count: number
): boolean {
  const targetEnd = startSlot + count - 1;
  if (targetEnd > 7) return false; // slots are 1-7

  const semCourses = existingCourses.filter((pc) => pc.semester === semester);

  for (const pc of semCourses) {
    const pcSpan = getOccupiedSlotCount(pc);
    if (rangesOverlap(pc.slot, pcSpan, startSlot, count)) return false;
  }
  return true;
}

function computeShiftChainForRange(
  existingCourses: Array<{
    id: number;
    semester: number;
    slot: number;
    slotSpan?: number;
    course: (Course & { options?: Array<{ offerings?: Array<{ duration?: string | number | null }> }> }) | null;
    plannerOption: PlannerOption | null;
  }>,
  semester: number,
  startSlot: number,
  count: number
): Array<{ id: number; newSlot: number }> | null {
  if (startSlot + count - 1 > 7) return null;
  const semCourses = existingCourses
    .filter((pc) => pc.semester === semester)
    .sort((a, b) => a.slot - b.slot);

  let allFree = true;
  for (let s = startSlot; s < startSlot + count; s++) {
    if (semCourses.some((pc) => rangesOverlap(pc.slot, getOccupiedSlotCount(pc), s, 1))) {
      allFree = false;
      break;
    }
  }
  if (allFree) return [];

  const maxSlot = 7;
  const usedTargets = new Set<number>();
  const chain: Array<{ id: number; newSlot: number }> = [];
  const processedIds = new Set<number>();

  for (let s = maxSlot; s >= startSlot; s--) {
    const occupant = semCourses.find(
      (pc) => !processedIds.has(pc.id) && rangesOverlap(pc.slot, getOccupiedSlotCount(pc), s, 1)
    );
    if (!occupant) continue;
    if (getPlannedDuration(occupant) === 2) return null;
    if (getOccupiedSlotCount(occupant) > 1) return null;

    const baseTarget = occupant.slot + count;
    let target = baseTarget;
    while (target <= maxSlot && usedTargets.has(target)) { target++; }
    if (target > maxSlot) return null;

    usedTargets.add(target);
    processedIds.add(occupant.id);
    chain.push({ id: occupant.id, newSlot: target });
  }

  return chain;
}

function computeShiftChain(
  existingCourses: Array<{
    id: number;
    semester: number;
    slot: number;
    slotSpan?: number;
    course: (Course & { options?: Array<{ offerings?: Array<{ duration?: string | number | null }> }> }) | null;
    plannerOption: PlannerOption | null;
  }>,
  semester: number,
  startSlot: number
): Array<{ id: number; newSlot: number }> | null {
  const semCourses = existingCourses
    .filter((pc) => pc.semester === semester)
    .sort((a, b) => a.slot - b.slot);

  // Check if startSlot is occupied by any course (including multi-slot courses that span into startSlot)
  const occupant = semCourses.find((pc) => rangesOverlap(pc.slot, getOccupiedSlotCount(pc), startSlot, 1));
  if (!occupant) return [];

  // Cannot shift full-year or multi-slot courses
  if (getPlannedDuration(occupant) === 2) return null;
  if (getOccupiedSlotCount(occupant) > 1) return null;

  // Find the first empty slot (shift chain)
  let emptySlot = startSlot;
  while (emptySlot <= 7) {
    const occupied = semCourses.some((pc) => rangesOverlap(pc.slot, getOccupiedSlotCount(pc), emptySlot, 1));
    if (!occupied) break;
    emptySlot++;
  }
  if (emptySlot > 7) return null;

  const chain: Array<{ id: number; newSlot: number }> = [];
  for (let slot = startSlot; slot < emptySlot; slot++) {
    const pc = semCourses.find((c) => rangesOverlap(c.slot, getOccupiedSlotCount(c), slot, 1));
    if (!pc) return null;
    if (getPlannedDuration(pc) === 2 || getOccupiedSlotCount(pc) > 1) return null;
    chain.push({ id: pc.id, newSlot: slot + 1 });
  }
  return chain;
}

function findFirstAvailableAdjacentPairInBothSemesters(
  existingCourses: Array<{
    id: number;
    semester: number;
    slot: number;
    slotSpan?: number;
    course: (Course & { slotsPerSemester?: number | null; options?: Array<{ offerings?: Array<{ duration?: string | number | null }> }> }) | null;
    plannerOption: PlannerOption | null;
  }>,
  count: number
): number | null {
  for (let slot = 1; slot <= 7 - count + 1; slot++) {
    if (
      hasConsecutiveFreeSlots(existingCourses, 1, slot, count) &&
      hasConsecutiveFreeSlots(existingCourses, 2, slot, count)
    ) {
      return slot;
    }
  }
  return null;
}

function serializePlannedCourse(plannedCourse: {
  id: number;
  plannerId: number;
  courseId: number | null;
  summerCourseId: number | null;
  plannerOptionId: number | null;
  semester: number;
  slot: number;
  slotSpan: number;
  isEarlyBird: boolean;
  course: (Course & { options?: Array<{ creditType?: string | null; credits?: number | null; offerings?: Array<{ duration?: string | null }> }> }) | null;
  summerCourse: (SummerCourse & { regularCourse?: (Course & { department?: { name: string; division?: { name: string } | null } | null; options?: Array<{ creditType?: string | null; credits?: number | null; offerings?: Array<{ duration?: string | null }> }> }) | null }) | null;
  plannerOption: PlannerOption | null;
}): PlannedCourseResponse {
  const { course, summerCourse, plannerOption } = plannedCourse;

  let courseDetails: CourseDetails;
  if (course) {
    courseDetails = deriveCourseDetails(course);
  } else if (plannerOption && !summerCourse) {
    courseDetails = derivePlannerOptionDetails(plannerOption);
  } else if (summerCourse) {
    const sd = deriveSummerCourseDetails(summerCourse);
    courseDetails = {
      id: -(SUMMER_ID_OFFSET + summerCourse.id),
      title: summerCourse.title,
      normalizedTitle: null,
      duration: summerCourse.duration === "full_summer" ? 2 : 1,
      slotsPerSemester: 1,
      creditType: null,
      credits: summerCourse.credits ?? null,
      division: sd.regularCourse?.division ?? null,
      department: sd.regularCourse?.department ?? null,
      description: null,
      fulfillsRequirements: sd.fulfillsRequirements,
      prerequisites: sd.prerequisites,
      courseCode: sd.courseCode,
      courseCodeS1: null,
      courseCodeS2: null,
      gradeMin: null,
      gradeMax: null,
      isNonAcademic: false,
      isMarchingBand: false,
      supportsEarlyBird: false,
      isRepeatable: sd.regularCourse?.isRepeatable ?? false,
      isOnline: false,
    };
  } else {
    throw new Error("Planned course has no course, summerCourse, or plannerOption");
  }

  return {
    id: plannedCourse.id,
    plannerId: plannedCourse.plannerId,
    courseId: plannedCourse.courseId,
    summerCourseId: plannedCourse.summerCourseId,
    plannerOptionId: plannedCourse.plannerOptionId,
    semester: plannedCourse.semester,
    slot: plannedCourse.slot,
    slotSpan: plannedCourse.slotSpan,
    isEarlyBird: plannedCourse.isEarlyBird,
    course: courseDetails,
    summerCourse: summerCourse ? deriveSummerCourseDetails(summerCourse) : null,
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
    completedAt: planner.completedAt ?? null,
    plannedCourses: planner.plannedCourses.map(serializePlannedCourse),
  };
}

import { analyzePlanners } from "../lib/plannerAnalysis.js";

router.get("/analysis", requireAuth, async (req, res) => {
  try {
    const analysis = await analyzePlanners(req.user!.id);
    res.json(analysis);
  } catch (err) {
    console.error("Failed to analyze planners:", err);
    res.status(500).json({ error: "Failed to analyze planners" });
  }
});

router.get("/", requireAuth, asyncHandler(async (req, res) => {
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
      },
    },
    orderBy: { schoolYear: "asc" },
  });

  const response: PlannerResponse[] = planners.map((planner) => ({
    id: planner.id,
    schoolYear: planner.schoolYear,
    label: YEAR_LABELS[planner.schoolYear],
    completedAt: planner.completedAt ?? null,
    plannedCourses: planner.plannedCourses.map(serializePlannedCourse),
  }));

  res.json(response);
}));

const GRADE_COMPLETED_BY_YEAR: Record<number, string> = {
  9: "Freshman (9)",
  10: "Sophomore (10)",
11: "Junior (11)",
  12: "Senior (12)",
};

// Following-year mapping for Summer School completions. A summer course planned
// in year N's Summer School section is taken during the summer before grade N
// (between grade N-1 and N), so it is recorded under the grade the student is
// about to enter.
const SUMMER_GRADE_COMPLETED_BY_YEAR: Record<number, string> = {
  9: "Freshman Summer",
  10: "Sophomore Summer",
  11: "Junior Summer",
  12: "Senior Summer",
};

router.post("/:plannerId/complete", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const plannerId = Number(req.params.plannerId);

  if (!plannerId) {
    return res.status(400).json({ error: "Invalid planner id" });
  }

  const planner = await prisma.planner.findUnique({
    where: { id: plannerId },
    include: {
      plannedCourses: {
        include: {
          course: {
            include: {
              department: { include: { division: true } },
              options: { include: { offerings: true } },
            },
          },
          plannerOption: true,
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
      },
    },
  });

  if (!planner || planner.userId !== userId) {
    return res.status(404).json({ error: "Planner not found" });
  }

  if (planner.plannedCourses.length === 0) {
    return res.status(409).json({ error: "Add planned courses before marking this year completed." });
  }

const gradeCompleted = GRADE_COMPLETED_BY_YEAR[planner.schoolYear];
  if (!gradeCompleted) {
    return res.status(400).json({ error: "Planner year cannot be marked completed" });
  }

  const courseIds = Array.from(new Set(
    planner.plannedCourses
      .map((pc) => pc.courseId)
      .filter((id): id is number => id != null)
  ));

  const summerCourseIds = Array.from(new Set(
    planner.plannedCourses
      .map((pc) => pc.summerCourseId)
      .filter((id): id is number => id != null)
  ));

  const completedAt = new Date();
  const createdIds: number[] = [];

  await prisma.$transaction(async (tx) => {
    if (courseIds.length > 0) {
      const existing = await tx.completedCourse.findMany({
        where: { userId, courseId: { in: courseIds } },
        select: { courseId: true },
      });
      const existingIds = new Set(existing.map((cc) => cc.courseId));

      for (const courseId of courseIds) {
        if (existingIds.has(courseId)) continue;
        const planned = planner.plannedCourses.find((pc) => pc.courseId === courseId);
        if (!planned?.course) continue;
        const record = await tx.completedCourse.create({
          data: {
            userId,
            courseId,
            gradeCompleted,
            credits: calculateTotalCredits(planned.course),
            createdAt: completedAt,
          },
        });
        createdIds.push(record.id);
      }
    }

    if (summerCourseIds.length > 0) {
      const summerGradeCompleted = SUMMER_GRADE_COMPLETED_BY_YEAR[planner.schoolYear];
      const existingSummer = await tx.completedCourse.findMany({
        where: { userId, summerCourseId: { in: summerCourseIds } },
        select: { summerCourseId: true },
      });
      const existingSummerIds = new Set(existingSummer.map((cc) => cc.summerCourseId));

      for (const summerCourseId of summerCourseIds) {
        if (existingSummerIds.has(summerCourseId)) continue;
        const planned = planner.plannedCourses.find((pc) => pc.summerCourseId === summerCourseId);
        if (!planned?.summerCourse) continue;
        const record = await tx.completedCourse.create({
          data: {
            userId,
            summerCourseId,
            gradeCompleted: summerGradeCompleted,
            credits: planned.summerCourse.credits ?? null,
            createdAt: completedAt,
          },
        });
        createdIds.push(record.id);
      }
    }

    await tx.planner.update({
      where: { id: planner.id },
      data: { completedAt },
    });
  });

  res.json(await getPlannerResponse(planner.id));
}));

router.post("/:plannerId/uncomplete", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const plannerId = Number(req.params.plannerId);

  if (!plannerId) {
    return res.status(400).json({ error: "Invalid planner id" });
  }

  const planner = await prisma.planner.findUnique({
    where: { id: plannerId },
    include: {
      plannedCourses: {
        where: { OR: [{ courseId: { not: null } }, { summerCourseId: { not: null } }] },
        select: { courseId: true, summerCourseId: true },
      },
    },
  });

  if (!planner || planner.userId !== userId) {
    return res.status(404).json({ error: "Planner not found" });
  }

  if (planner.completedAt == null) {
    return res.status(409).json({ error: "This year is not marked as completed." });
  }

  const courseIds = Array.from(new Set(
    planner.plannedCourses
      .map((pc) => pc.courseId)
      .filter((id): id is number => id != null)
  ));

  const summerCourseIds = Array.from(new Set(
    planner.plannedCourses
      .map((pc) => pc.summerCourseId)
      .filter((id): id is number => id != null)
  ));

  const gradeLabel = GRADE_COMPLETED_BY_YEAR[planner.schoolYear];

  await prisma.$transaction(async (tx) => {
    if (courseIds.length > 0) {
      await tx.completedCourse.deleteMany({
        where: {
          userId,
          courseId: { in: courseIds },
          createdAt: planner.completedAt!,
        },
      });
    }

    if (summerCourseIds.length > 0) {
      await tx.completedCourse.deleteMany({
        where: {
          userId,
          summerCourseId: { in: summerCourseIds },
          createdAt: planner.completedAt!,
        },
      });
    }

    await tx.planner.update({
      where: { id: planner.id },
      data: { completedAt: null },
    });
  });

  res.json(await getPlannerResponse(planner.id));
}));

router.get("/options", requireAuth, asyncHandler(async (req, res) => {
  const grade = Number(req.query.grade);

  const options = await prisma.plannerOption.findMany({
    where: Number.isFinite(grade) ? { availableGrades: { has: grade } } : {},
    orderBy: { name: "asc" },
  });

  res.json(options);
}));

router.post("/courses", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { plannerId, courseId, plannerOptionId, summerCourseId, semester, slot, isEarlyBird } = req.body;

  console.log({
    endpoint: "add",
    body: req.body,
    semester: req.body.semester,
    slot: req.body.slot,
    slotNum: Number(req.body.slot),
  });

  if (!plannerId || (!courseId && !plannerOptionId && !summerCourseId) || semester == null || slot == null) {
    return res.status(400).json({ error: "plannerId, one of courseId, plannerOptionId, or summerCourseId, semester, and slot are required" });
  }

  if ([courseId, plannerOptionId, summerCourseId].filter((v) => v != null).length > 1) {
    return res.status(400).json({ error: "Cannot provide more than one of courseId, plannerOptionId, or summerCourseId" });
  }

  const semesterNum = Number(semester);
  const slotNum = Number(slot);

  if (semesterNum < 1 || semesterNum > 6) {
    return res.status(400).json({ error: "semester must be between 1 and 6" });
  }

  if (slotNum < 1 || slotNum > 7) {
    console.trace("Invalid slot");
    return res.status(400).json({ error: "slot must be between 1 and 7" });
  }

  const planner = await prisma.planner.findUnique({
    where: { id: Number(plannerId) },
  });

  if (!planner || planner.userId !== userId) {
    return res.status(404).json({ error: "Planner not found" });
  }

  let duration: number;
  let slotSpan = 1;
  let isEarlyBirdValue = isEarlyBird === true;
  let createData: { plannerId: number; courseId?: number; summerCourseId?: number; plannerOptionId?: number; semester: number; slot: number; slotSpan: number; isEarlyBird: boolean };

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

    if (isEarlyBirdValue && !isOnePointFivePeriodScienceCourse(course)) {
      return res.status(400).json({ error: "Early Bird is only available for 1.5-period science courses." });
    }

    if (courseFulfillsDriverEducation(course) && (await hasDriverEdExternalResolution(userId))) {
      return res.status(409).json({
        error:
          "Driver Education is already marked as completed outside of school. Undo that first to add it to your planner.",
      });
    }

    const existingDuplicate = await prisma.plannedCourse.findFirst({
      where: isRepeatableEligibleCourse(course)
        ? { plannerId: planner.id, courseId: course.id, semester: semesterNum }
        : { planner: { userId }, courseId: course.id },
    });

    if (existingDuplicate) {
      return res.status(409).json({ error: "This course is already planned in your schedule" });
    }

    // The Summer School equivalent of a regular course is the same course
    // attempt. Block adding the regular course when its summer equivalent is
    // already planned or completed, unless it is a repeatable one-semester PE.
    if (!isRepeatableEligibleCourse(course)) {
      const summerEquivalentPlanned = await findSummerEquivalentPlanned(userId, course.id);
      if (summerEquivalentPlanned) {
        return res.status(409).json({ error: "The Summer School equivalent of this course is already planned in your schedule." });
      }
      const summerEquivalentCompleted = await findSummerEquivalentCompleted(userId, course.id);
      if (summerEquivalentCompleted) {
        return res.status(409).json({ error: "You have already completed the Summer School equivalent of this course." });
      }
    }

    duration = deriveCourseDuration(course);
    slotSpan = effectiveSlotsPerSemester(course);
    createData = { plannerId: planner.id, courseId: course.id, semester: semesterNum, slot: slotNum, slotSpan, isEarlyBird: isEarlyBirdValue };
  } else if (plannerOptionId) {
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
    createData = { plannerId: planner.id, plannerOptionId: option.id, semester: semesterNum, slot: slotNum, slotSpan: 1, isEarlyBird: false };
  } else {
    // Summer School placement. Only offered in Summer School semesters (3/4).
    if (semesterNum < 3 || semesterNum > 4) {
      return res.status(400).json({
        error: "Summer courses can only be planned in a Summer School semester (Semester 1 or 2 of Summer School).",
      });
    }

    const summer = await prisma.summerCourse.findUnique({
      where: { id: Number(summerCourseId) },
      include: {
        sessions: true,
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
    });

    if (!summer) {
      return res.status(404).json({ error: "Summer course not found" });
    }

    const gradeLevels = summer.gradeLevels ?? [];
    if (gradeLevels.length > 0 && !gradeLevels.includes(planner.schoolYear)) {
      return res.status(409).json({
        error: `${summer.title} is open to grade${gradeLevels.length === 1 ? "" : "s"} ${gradeLevels.join("-")} and cannot be planned for the summer before grade ${planner.schoolYear}.`,
      });
    }

    // Session vocabulary: Session 1 = Summer School Semester 1 (3), Session 2 = Semester 2 (4).
    const sessionNames = summer.sessions.map((s) => s.session.trim().toLowerCase());
    const expectedSession = semesterNum === 4 ? "session 2" : "session 1";
    if (sessionNames.length > 0 && !sessionNames.includes(expectedSession)) {
      return res.status(409).json({
        error: `${summer.title} is offered in ${summer.sessions.map((s) => s.session).join(", ")} but not in ${expectedSession.replace(/^\w/, (c) => c.toUpperCase())}.`,
      });
    }

    const existingDuplicate = await prisma.plannedCourse.findFirst({
      where: { planner: { userId }, summerCourseId: summer.id },
    });

    if (existingDuplicate) {
      return res.status(409).json({ error: "This summer course is already planned in your schedule" });
    }

    // The Summer School course is the same course attempt as its matched
    // regular equivalent. Block the summer placement when the regular
    // equivalent is already planned or completed (unless repeatable one-sem PE).
    const regularEquivalent = summer.regularCourse;
    if (regularEquivalent && !isRepeatableOneSemesterPe(regularEquivalent)) {
      const plannedRegular = await findRegularEquivalentPlanned(userId, regularEquivalent.id);
      if (plannedRegular) {
        return res.status(409).json({ error: "This course is already planned in your schedule (regular equivalent)." });
      }
      const completedRegular = await findRegularEquivalentCompleted(userId, regularEquivalent.id);
      if (completedRegular) {
        return res.status(409).json({ error: "You have already completed this course (regular equivalent)." });
      }
    }

    const isFullSummer = summer.duration === "full_summer";
    if (isFullSummer) {
      const bothSessions = sessionNames.includes("session 1") && sessionNames.includes("session 2");
      if (sessionNames.length > 0 && !bothSessions) {
        return res.status(409).json({
          error: `${summer.title} is offered in ${summer.sessions.map((s) => s.session).join(", ")} and cannot span the full summer.`,
        });
      }
    }

    duration = isFullSummer ? 2 : 1;
    createData = { plannerId: planner.id, summerCourseId: summer.id, semester: semesterNum, slot: slotNum, slotSpan: 1, isEarlyBird: false };
  }

  const existingCourses = await prisma.plannedCourse.findMany({
    where: { plannerId: planner.id },
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

// Semester 3-6 (Summer School 1/2, Online 1/2) live outside the regular
  // S1/S2 grid. Each semester holds exactly ONE course position (no slots 2-7).
  // A full-year course occupies both members of its block.
  const isOutOfSchedule = semesterNum > 2;
  const targetSemesters = isOutOfSchedule
    ? (duration === 2 ? outOfSemesterBlock(semesterNum) : [semesterNum])
    : (duration === 2 ? [1, 2] : [semesterNum]);
  const shifts: Array<{ id: number; semester: number; newSlot: number }> = [];

  if (isOutOfSchedule) {
    const sectionName = semesterNum <= 4 ? "Summer School" : "Online Courses";
    const occupiedSemester = targetSemesters.find((sem) =>
      existingCourses.some((pc) => pc.semester === sem && (pc.courseId != null || pc.summerCourseId != null || pc.plannerOptionId != null))
    );
    if (occupiedSemester != null) {
      const subIndex = occupiedSemester % 2 === 0 ? 2 : 1;
      return res.status(409).json({
        error: `${sectionName} Semester ${subIndex} already has a course. Only one course is allowed per semester. Remove it before adding another.`,
      });
    }
    createData = { ...createData, slot: 1, slotSpan: 1 };
  } else {
    // Enforce at most one Early Bird course per semester. A full-year Early Bird
    // course occupies both semesters.
    if (isEarlyBirdValue) {
      for (const sem of targetSemesters) {
        const existingEb = existingCourses.find(
          (pc) => pc.semester === sem && pc.isEarlyBird && pc.courseId !== Number(courseId)
        );
        if (existingEb) {
          return res.status(409).json({ error: "You may only take one Early Bird course each semester." });
        }
      }
    }

    if (slotSpan > 1) {
      let startSlot: number | null = null;

      if (duration === 2) {
        const sem1Chain = computeShiftChainForRange(existingCourses, 1, slotNum, slotSpan);
        const sem2Chain = computeShiftChainForRange(existingCourses, 2, slotNum, slotSpan);

        if (sem1Chain !== null && sem2Chain !== null) {
          startSlot = slotNum;
          shifts.push(...sem1Chain.map((s) => ({ ...s, semester: 1 })));
          shifts.push(...sem2Chain.map((s) => ({ ...s, semester: 2 })));
        } else {
          startSlot = findFirstAvailableAdjacentPairInBothSemesters(existingCourses, slotSpan);
        }
      } else {
        const chain = computeShiftChainForRange(existingCourses, semesterNum, slotNum, slotSpan);
        if (chain !== null) {
          startSlot = slotNum;
          shifts.push(...chain.map((s) => ({ ...s, semester: semesterNum })));
        }
      }

      if (startSlot == null) {
        return res.status(409).json({
          error:
            duration === 2
              ? "American Studies requires two consecutive periods. There is not enough space in this semester."
              : `Not enough consecutive free slots to place this course. It needs ${slotSpan} consecutive slot(s) per semester.`,
        });
      }
      createData = { ...createData, slot: startSlot, slotSpan };
    } else {
      for (const sem of targetSemesters) {
        const chain = computeShiftChain(existingCourses, sem, slotNum);
        if (chain === null) {
          const msg = duration === 2
            ? "Not enough room to place this full-year course."
            : "This slot is blocked by a course that cannot be moved.";
          return res.status(409).json({ error: msg });
        }
        shifts.push(...chain.map((shift) => ({ ...shift, semester: sem })));
      }

      if (duration === 1) {
        const occupant = existingCourses.find(
          (pc) => pc.semester === semesterNum && rangesOverlap(pc.slot, getOccupiedSlotCount(pc), slotNum, 1)
        );
        if (occupant) {
          return res.status(409).json({ error: "Slot is already occupied" });
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // Apply shifts from highest new slot to lowest to avoid transient unique-key collisions.
    for (const shift of shifts.sort((a, b) => b.newSlot - a.newSlot)) {
      await tx.plannedCourse.update({
        where: { id: shift.id },
        data: { slot: shift.newSlot },
      });
    }
    for (const sem of targetSemesters) {
      await tx.plannedCourse.create({
        data: { ...createData, semester: sem },
      });
    }
  });

  res.status(201).json(await getPlannerResponse(planner.id));
}));

router.delete("/courses/:id", requireAuth, asyncHandler(async (req, res) => {
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

  if (!plannedCourse || plannedCourse.planner.userId !== userId) {
    return res.status(404).json({ error: "Planned course not found" });
  }

if (plannedCourse.courseId) {
    await prisma.plannedCourse.deleteMany({
      where: {
        plannerId: plannedCourse.plannerId,
        courseId: plannedCourse.courseId,
      },
    });
  } else if (plannedCourse.summerCourseId) {
    await prisma.plannedCourse.deleteMany({
      where: {
        plannerId: plannedCourse.plannerId,
        summerCourseId: plannedCourse.summerCourseId,
      },
    });
  } else if (plannedCourse.plannerOptionId && getPlannedDuration(plannedCourse) === 2) {
    await prisma.plannedCourse.deleteMany({
      where: {
        plannerId: plannedCourse.plannerId,
        plannerOptionId: plannedCourse.plannerOptionId,
      },
    });
  } else {
    await prisma.plannedCourse.deleteMany({
      where: {
        id: plannedCourseId,
        planner: { userId },
      },
    });
  }

  res.status(204).send();
}));

router.patch("/courses/:id/early-bird", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const plannedCourseId = Number(req.params.id);
  const { isEarlyBird } = req.body;

  if (!plannedCourseId) {
    return res.status(400).json({ error: "Invalid planned course id" });
  }
  if (typeof isEarlyBird !== "boolean") {
    return res.status(400).json({ error: "isEarlyBird must be a boolean" });
  }

  const plannedCourse = await prisma.plannedCourse.findUnique({
    where: { id: plannedCourseId },
    include: {
      planner: true,
      course: {
        include: {
          department: { include: { division: true } },
          options: { include: { offerings: true } },
        },
      },
    },
  });

  if (!plannedCourse || plannedCourse.planner.userId !== userId) {
    return res.status(404).json({ error: "Planned course not found" });
  }

  if (plannedCourse.courseId == null || !plannedCourse.course) {
    return res.status(400).json({ error: "Early Bird can only be toggled for catalog courses." });
  }

  if (!isOnePointFivePeriodScienceCourse(plannedCourse.course)) {
    return res.status(400).json({ error: "Early Bird is only available for 1.5-period science courses." });
  }

  if (isEarlyBird) {
    const sourceDuration = deriveCourseDuration(plannedCourse.course);
    const targetSemesters = sourceDuration === 2 ? [1, 2] : [plannedCourse.semester];
    const otherEb = await prisma.plannedCourse.findFirst({
      where: {
        plannerId: plannedCourse.plannerId,
        isEarlyBird: true,
        courseId: { not: plannedCourse.courseId },
        semester: { in: targetSemesters },
      },
    });
    if (otherEb) {
      return res.status(409).json({ error: "You may only take one Early Bird course each semester." });
    }
  }

  // Toggle applies to every placement of the logical course (both semesters for
  // a full-year course) so the planner stays consistent.
  await prisma.plannedCourse.updateMany({
    where: {
      plannerId: plannedCourse.plannerId,
      courseId: plannedCourse.courseId,
    },
    data: { isEarlyBird },
  });

  res.json(await getPlannerResponse(plannedCourse.plannerId));
}));

router.post("/courses/:id/move", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const plannedCourseId = Number(req.params.id);
  const { semester, slot } = req.body;

  console.log({
    endpoint: "move",
    body: req.body,
    semester: req.body.semester,
    slot: req.body.slot,
    slotNum: Number(req.body.slot),
  });

  if (!plannedCourseId) {
    return res.status(400).json({ error: "Invalid planned course id" });
  }

  const semesterNum = Number(semester);
  const slotNum = Number(slot);

  if (Number.isNaN(semesterNum) || semesterNum < 1 || semesterNum > 6) {
    return res.status(400).json({ error: "semester must be between 1 and 6" });
  }

  if (Number.isNaN(slotNum) || slotNum < 1 || slotNum > 7) {
    console.trace("Invalid slot");
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

  if (!source || source.planner.userId !== userId) {
    return res.status(404).json({ error: "Planned course not found" });
  }

  if (source.summerCourseId != null && (semesterNum < 3 || semesterNum > 4)) {
    return res.status(400).json({ error: "Summer courses can only be planned in Summer School semesters." });
  }

  if (semesterNum > 2) {
    const sourceDuration = getPlannedDuration(source);
    const targetSemesters = sourceDuration === 2 ? outOfSemesterBlock(semesterNum) : [semesterNum];
    const logicalRows = await prisma.plannedCourse.findMany({
      where: getLogicalCourseWhere(source),
    });
    const otherCourses = await prisma.plannedCourse.findMany({
      where: {
        plannerId: source.plannerId,
        NOT: { id: { in: logicalRows.map((r) => r.id) } },
      },
      include: {
        course: {
          include: {
            options: {
              include: { offerings: true },
            },
          },
        },
        plannerOption: true,
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
    const sectionName = semesterNum <= 4 ? "Summer School" : "Online Courses";
    const occupiedSemester = targetSemesters.find((sem) =>
      otherCourses.some((pc) => pc.semester === sem && (pc.courseId != null || pc.summerCourseId != null || pc.plannerOptionId != null))
    );
    if (occupiedSemester != null) {
      const subIndex = occupiedSemester % 2 === 0 ? 2 : 1;
      return res.status(409).json({
        error: `No room in ${sectionName}. Semester ${subIndex} already has a course. Only one course is allowed per semester.`,
      });
    }
    await prisma.$transaction(async (tx) => {
      for (const row of logicalRows) {
        await tx.plannedCourse.update({ where: { id: row.id }, data: { slot: -row.id } });
      }
      const rows = logicalRows.sort((a, b) => a.semester - b.semester);
      for (let i = 0; i < rows.length; i++) {
        await tx.plannedCourse.update({
          where: { id: rows[i].id },
          data: { semester: targetSemesters[i % targetSemesters.length], slot: 1 },
        });
      }
    });
    return res.json(await getPlannerResponse(source.plannerId));
  }

  const sourceDuration = getPlannedDuration(source);
  const sourceOccupiedSlots = getOccupiedSlotCount(source);
  const sourceSemesters = sourceDuration === 2 ? [1, 2] : [source.semester];
  const targetSemesters = sourceDuration === 2 ? [1, 2] : [semesterNum];

  if (sourceOccupiedSlots > 1 && sourceDuration !== 2) {
    return res.status(409).json({
      error: "Multi-slot semester courses cannot be moved via drag-and-drop. Remove and re-add instead.",
    });
  }

  if (sourceDuration === 2 && source.course?.slotsPerSemester && source.course.slotsPerSemester > 1) {
    const blockWidth = source.course.slotsPerSemester;
    const currentBlock = await prisma.plannedCourse.findMany({
      where: getLogicalCourseWhere(source),
      orderBy: [{ semester: "asc" }, { slot: "asc" }],
    });
    const currentStart = Math.min(...currentBlock.map((pc) => pc.slot));
    if (slotNum === currentStart) return res.json(await getPlannerResponse(source.plannerId));

    const otherCourses = await prisma.plannedCourse.findMany({
      where: {
        plannerId: source.plannerId,
        NOT: { id: { in: currentBlock.map((pc) => pc.id) } },
      },
      include: {
        course: { include: { options: { include: { offerings: true } } } },
        plannerOption: true,
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
    if (
      !hasConsecutiveFreeSlots(otherCourses, 1, slotNum, blockWidth) ||
      !hasConsecutiveFreeSlots(otherCourses, 2, slotNum, blockWidth)
    ) {
      return res.status(409).json({
        error: "American Studies requires two adjacent class periods in both semesters.",
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const pc of currentBlock) {
        await tx.plannedCourse.update({ where: { id: pc.id }, data: { slot: -pc.id } });
      }
      const sorted = currentBlock.sort((a, b) => a.semester - b.semester || a.slot - b.slot);
      for (const pc of sorted) {
        const offset = pc.slot - currentStart;
        await tx.plannedCourse.update({ where: { id: pc.id }, data: { slot: slotNum + offset } });
      }
    });
    return res.json(await getPlannerResponse(source.plannerId));
  }

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
}));

export default router;

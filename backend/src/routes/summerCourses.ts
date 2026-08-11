import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import type { Course, CourseOption, CourseOffering } from "@prisma/client";
import { deriveSummerCourseDetails } from "../lib/summerCourseDetails.js";

const router = Router();

type SummerCourseWithRelations = {
  id: number;
  key: string;
  title: string;
  courseCode: string | null;
  creditStatus: string;
  credits: number | null;
  gradeLevels: number[];
  duration: string;
  prerequisites: unknown;
  corequisites: unknown;
  fulfillsRequirements: unknown;
  isSummerOnly: boolean;
  regularCourseId: number | null;
  matchedTitle: string | null;
  matchedCourseCode: string | null;
  matchConfidence: string | null;
  sourcePage: number;
  sourceReference: string | null;
  notes: unknown;
  extractionIssues: unknown;
  sessions: Array<{ session: string; ordinal: number }>;
  requirement: Array<{
    sourceName: string;
    graduationRequirement: { id: number; name: string };
  }>;
  regularCourse:
    | (Course & {
        department?: { name: string; division?: { name: string } | null } | null;
        options?: Array<
          CourseOption & {
            offerings?: CourseOffering[];
          }
        >;
      })
    | null;
};

type SummerCourseResponse = ReturnType<typeof deriveSummerCourseDetails> & {
  sessions: string[];
  requirement: Array<{ sourceName: string; graduationRequirement: { id: number; name: string } }>;
};

function toSummerCourseResponse(course: SummerCourseWithRelations): SummerCourseResponse {
  return {
    ...deriveSummerCourseDetails(course),
    sessions: course.sessions
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((s) => s.session),
    requirement: course.requirement.map((r) => ({
      sourceName: r.sourceName,
      graduationRequirement: {
        id: r.graduationRequirement.id,
        name: r.graduationRequirement.name,
      },
    })),
  };
}

router.get("/", async (_req, res) => {
  try {
    const courses = await prisma.summerCourse.findMany({
      include: {
        sessions: true,
        requirement: {
          include: {
            graduationRequirement: true,
          },
        },
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
      orderBy: { title: "asc" },
    });

    res.json((courses as unknown as SummerCourseWithRelations[]).map(toSummerCourseResponse));
  } catch (error) {
    console.error("Failed to fetch summer courses:", error);
    res.status(500).json({ error: "Failed to fetch summer courses" });
  }
});

export default router;
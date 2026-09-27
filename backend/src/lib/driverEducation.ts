import { prisma } from "./prisma.js";
import { canonicalRequirementName } from "./requirementsCleanup.js";
import { isMiddleSchoolGrade } from "./completedCourses.js";

export function courseFulfillsDriverEducation(course: {
  fulfillsRequirements: unknown;
}): boolean {
  if (!Array.isArray(course.fulfillsRequirements)) return false;
  return course.fulfillsRequirements.some(
    (raw) =>
      typeof raw === "string" &&
      canonicalRequirementName(raw).trim().toLowerCase() === "driver education"
  );
}

export async function hasDriverEdExternalResolution(userId: number): Promise<boolean> {
  const resolutions = await prisma.requirementResolution.findMany({
    where: { userId, type: "pe_waiver" },
    select: { metadata: true },
  });
  return resolutions.some(
    (r) =>
      (r.metadata as unknown as Record<string, unknown> | null | undefined)?.variant ===
      "driver_ed_external"
  );
}

export async function hasDriverEducationCourse(userId: number): Promise<boolean> {
  const planned = await prisma.plannedCourse.findMany({
    where: { planner: { userId } },
    select: { course: { select: { fulfillsRequirements: true } } },
  });
  if (planned.some((pc) => pc.course && courseFulfillsDriverEducation(pc.course))) {
    return true;
  }

  // Middle-school completions never count toward graduation, so they must not
  // be treated as "already handled" -- otherwise they would block the only
  // remaining way to satisfy the requirement (marking it completed outside
  // school).
  const completed = await prisma.completedCourse.findMany({
    where: { userId },
    select: { gradeCompleted: true, course: { select: { fulfillsRequirements: true } } },
  });
  return completed.some(
    (cc) =>
      cc.course &&
      !isMiddleSchoolGrade(cc.gradeCompleted) &&
      courseFulfillsDriverEducation(cc.course)
  );
}

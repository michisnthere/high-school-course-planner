import type { PlannedCourse } from "./planner";
import { effectiveSlotSpan, getCourseCredits, getPlacementKey } from "./courseCredits";
import { isOutOfSemester } from "./plannerSemesters";

export type WaiverVariant = "academic" | "athletic" | "marching-band";

export const ALL_WAIVER_VARIANTS: WaiverVariant[] = ["academic", "athletic", "marching-band"];

// Waivers that can never apply to the given grade are hidden entirely.
export function getAvailableWaiverVariants(grade: number): WaiverVariant[] {
  return ALL_WAIVER_VARIANTS.filter((variant) => {
    if (variant === "academic") return grade >= 12;
    if (variant === "athletic") return grade >= 11;
    return true;
  });
}

export type AcademicPeWaiver = { type: "academic" };

export type AthleticPeWaiver = {
  type: "athletic";
  variant: "non-credit" | "credit";
};

export type MarchingBandPeWaiver = { type: "marching-band" };

export type PeWaiver = AcademicPeWaiver | AthleticPeWaiver | MarchingBandPeWaiver;

export type WaiverEligibility = {
  academic: {
    eligible: boolean;
    reason: string;
  };
  athletic: {
    eligible: boolean;
    reason: string;
  };
  marchingBand: {
    eligible: boolean;
    reason: string;
    matchedCourse: string | null;
  };
};

export function findMarchingBandCourse(
  plannedCourses: PlannedCourse[]
): { found: boolean; matchedTitle: string | null } {
  for (const pc of plannedCourses) {
    if (pc.course.isMarchingBand) {
      return { found: true, matchedTitle: pc.course.title };
    }
  }
  return { found: false, matchedTitle: null };
}

export function getCreditBearingCount(
  plannedCourses: PlannedCourse[]
): { sem1: number; sem2: number } {
  const sem1Courses = new Set<string>();
  const sem2Courses = new Set<string>();
  const countedFullYear = new Set<string>();

  for (const pc of plannedCourses) {
    if (isOutOfSemester(pc.semester)) continue;
    const credits = getCourseCredits(pc.course);
    if (credits <= 0) continue;
    if (pc.course.isNonAcademic) continue;

    if (pc.course.duration === 2) {
      const span = effectiveSlotSpan(pc);
      for (let i = 0; i < span; i++) {
        const key = `${pc.courseId}-${pc.slot}-${i}`;
        if (countedFullYear.has(key)) continue;
        countedFullYear.add(key);
        sem1Courses.add(key);
        sem2Courses.add(key);
      }
    } else {
      const key = getPlacementKey(pc);
      if (pc.semester === 1) sem1Courses.add(key);
      if (pc.semester === 2) sem2Courses.add(key);
    }
  }

  return { sem1: sem1Courses.size, sem2: sem2Courses.size };
}

export function computeWaiverEligibility(
  grade: number,
  creditBearing: { sem1: number; sem2: number },
  plannedCourses?: PlannedCourse[]
): WaiverEligibility {
  const minCreditBearing = Math.min(creditBearing.sem1, creditBearing.sem2);

  const academic = {
    eligible: grade >= 12 && minCreditBearing >= 6,
    reason:
      grade < 12
        ? "Only available to Seniors"
        : minCreditBearing < 6
        ? "Requires six credit-bearing classes per semester"
        : "Academic PE Waiver may be available.",
  };

  const athletic = {
    eligible: grade >= 11,
    reason:
      grade < 11
        ? "Only available to Juniors and Seniors"
        : "Athletic PE Waiver may be available.",
  };

  const mb = plannedCourses ? findMarchingBandCourse(plannedCourses) : { found: false, matchedTitle: null };
  const marchingBand = {
    eligible: mb.found,
    reason: mb.found
      ? "Marching Band course found."
      : "Marching Band course not found in planner.",
    matchedCourse: mb.matchedTitle,
  };

  return { academic, athletic, marchingBand };
}

export function computeAthleticVariantEligibility(
  sportCount: "one" | "two-or-more",
  creditBearing: { sem1: number; sem2: number }
): { eligible: boolean; variant: "non-credit" | "credit" | null; reason: string } {
  const minCreditBearing = Math.min(creditBearing.sem1, creditBearing.sem2);

  console.log("PE WAIVER ATHLETIC CHECK", {
    sportCount,
    creditBearingSem1: creditBearing.sem1,
    creditBearingSem2: creditBearing.sem2,
    minCreditBearing,
    threshold: sportCount === "one" ? 6 : 5,
    met: minCreditBearing >= (sportCount === "one" ? 6 : 5),
  });

  if (sportCount === "one") {
    if (minCreditBearing >= 6) {
      return {
        eligible: true,
        variant: "non-credit",
        reason: "Non-credit athletic waiver based on one sport and six credit-bearing classes.",
      };
    }
    return {
      eligible: false,
      variant: null,
      reason: "One sport requires six credit-bearing classes.",
    };
  }

  if (minCreditBearing >= 5) {
    return {
      eligible: true,
      variant: "credit",
      reason: "Credit athletic waiver based on two or more sports and five credit-bearing classes.",
    };
  }
  return {
    eligible: false,
    variant: null,
    reason: "Two or more sports requires five credit-bearing classes.",
  };
}

export function courseFulfillsDriverEducation(course: {
  fulfillsRequirements?: string[] | null;
}): boolean {
  const requirements = (course.fulfillsRequirements ?? []).map((r) =>
    r.trim().toLowerCase().replace(/\s+/g, " ")
  );
  return requirements.some(
    (r) => r === "driver education" || r === "driver education graduation requirement"
  );
}

export function isDriverEdExternalResolution(resolution: {
  type: string;
  metadata?: Record<string, unknown> | null;
}): boolean {
  return (
    resolution.type === "pe_waiver" &&
    resolution.metadata?.variant === "driver_ed_external"
  );
}

export function findDriverEdExternalResolution<
  T extends { type: string; metadata?: Record<string, unknown> | null }
>(resolutions: T[]): T | null {
  return resolutions.find(isDriverEdExternalResolution) ?? null;
}

export function hasDriverEducationCourse(
  plannedCourses: Array<{ course: { fulfillsRequirements?: string[] | null } }>,
  completedCourses: Array<{ course: { fulfillsRequirements?: string[] | null } | null }>
): boolean {
  return (
    plannedCourses.some((pc) => courseFulfillsDriverEducation(pc.course)) ||
    completedCourses.some((cc) => (cc.course ? courseFulfillsDriverEducation(cc.course) : false))
  );
}

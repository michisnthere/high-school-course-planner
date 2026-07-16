import type { PlannedCourse } from "./planner";
import { getCourseCredits, getPlacementKey } from "./courseCredits";

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
  const seen = new Set<string>();

  for (const pc of plannedCourses) {
    const credits = getCourseCredits(pc.course);
    if (credits <= 0) continue;
    if (pc.course.isNonAcademic) continue;

    const key = getPlacementKey(pc);
    if (seen.has(key)) continue;
    seen.add(key);

    if (pc.course.duration === 2 || pc.semester === 1) {
      sem1Courses.add(key);
    }
    if (pc.course.duration === 2 || pc.semester === 2) {
      sem2Courses.add(key);
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

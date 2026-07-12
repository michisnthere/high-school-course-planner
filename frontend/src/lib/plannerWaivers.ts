import type { PlannedCourse } from "./planner";

export type AcademicPeWaiver = {
  type: "academic";
};

export type AthleticPeWaiver = {
  type: "athletic";
  variant: "non-credit" | "credit";
};

export type PeWaiver = AcademicPeWaiver | AthleticPeWaiver;

export type WaiverEligibility = {
  academic: {
    eligible: boolean;
    reason: string;
  };
  athletic: {
    eligible: boolean;
    reason: string;
  };
};

export function getCreditBearingCount(
  plannedCourses: PlannedCourse[]
): { sem1: number; sem2: number } {
  const sem1Courses = new Set<string>();
  const sem2Courses = new Set<string>();
  const fullYearDedup = new Set<string>();

  for (const pc of plannedCourses) {
    const credits = pc.course.credits ?? pc.course.duration;
    if (credits <= 0) continue;
    if (pc.course.title === "Study Hall" || pc.course.title === "Free Period") continue;

    if (pc.course.duration === 2) {
      const key = `${pc.courseId}-${pc.slot}`;
      if (fullYearDedup.has(key)) continue;
      fullYearDedup.add(key);
      sem1Courses.add(key);
      sem2Courses.add(key);
    } else {
      const key = `${pc.courseId}-${pc.slot}-${pc.semester}`;
      if (pc.semester === 1) {
        sem1Courses.add(key);
      } else {
        sem2Courses.add(key);
      }
    }
  }

  return { sem1: sem1Courses.size, sem2: sem2Courses.size };
}

export function computeWaiverEligibility(
  grade: number,
  creditBearing: { sem1: number; sem2: number }
): WaiverEligibility {
  const minCreditBearing = Math.min(creditBearing.sem1, creditBearing.sem2);

  return {
    academic: {
      eligible: grade >= 12 && minCreditBearing >= 6,
      reason:
        grade < 12
          ? "Only available to Seniors"
          : minCreditBearing < 6
          ? "Requires six credit-bearing classes per semester"
          : "Academic PE Waiver may be available.",
    },
    athletic: {
      eligible: grade >= 11,
      reason:
        grade < 11
          ? "Only available to Juniors and Seniors"
          : "Athletic PE Waiver may be available.",
    },
  };
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

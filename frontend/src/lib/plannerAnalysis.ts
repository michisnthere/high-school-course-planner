export type PlannerAnalysis = {
  credits: {
    total: number;
    byRequirementCategory: Record<string, number>;
    byDivision: Record<string, number>;
  };
  graduationRequirements: Array<{
    id: number;
    name: string;
    category: string | null;
    requirementType: string | null;
    requiredValue: number | null;
    earnedValue: number;
    remainingValue: number;
    status: "satisfied" | "partial" | "notStarted";
    recommendedCourses: Array<{
      courseId: number;
      title: string;
      reason: string;
    }>;
  }>;
  informationItems: Array<{
    id: number;
    name: string;
    category: string | null;
    requirementType: string | null;
    notes: unknown;
    sourceReference: string | null;
    explanation: string;
  }>;
  yearRequirements: Array<{
    grade: number;
    english: { required: boolean; met: boolean; earnedCredits: number };
    math: { required: boolean; met: boolean; earnedCredits: number };
    science: { required: boolean; met: boolean; earnedCredits: number };
  }>;
  duplicateCourses: Array<{
    courseId: number;
    title: string;
    count: number;
    placements: Array<{ year: number; semester: number[]; slot: number }>;
  }>;
  missingPrerequisites: Array<{
    plannedCourseId: number;
    courseTitle: string;
    year: number;
    semester: number;
    missingPrerequisite: string;
    reason: "notPlanned" | "plannedLater";
  }>;
  plannerStatistics: {
    coursesScheduled: number;
    freeSlotsRemaining: number;
    studyHallCount: number;
    freePeriodCount: number;
  };
};

const API_URL =
  typeof window === "undefined" ? "http://localhost:4000" : process.env.NEXT_PUBLIC_API_URL || "";

export async function getPlannerAnalysis(): Promise<PlannerAnalysis> {
  const response = await fetch(`${API_URL}/api/planner/analysis`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch planner analysis");
  }

  return response.json();
}

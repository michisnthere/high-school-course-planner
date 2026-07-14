export type PeSemesterBreakdown = {
  semester: number;
  met: boolean;
  courseTitle: string | null;
  courseId: number | null;
};

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
    label: string;
    items: Array<{
      category: string;
      required: boolean;
      met: boolean;
      earnedCredits: number;
      requiredCredits: number;
      matches: string[];
    }>;
    satisfiedCount: number;
    totalCount: number;
  }>;
  peSemesterBreakdown: PeSemesterBreakdown[];
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
  resolutions: Array<{
    id: number;
    type: string;
    courseId: number | null;
    metadata: Record<string, unknown>;
  }>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function getPlannerAnalysis(): Promise<PlannerAnalysis> {
  const response = await fetch(`${API_URL}/api/planner/analysis`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch planner analysis");
  }

  return response.json();
}

import type { IAnalysisService } from "./types";
import type { StudentPlanningData } from "@/lib/studentData";
import { getPlannerAnalysis as authGetPlannerAnalysis } from "@/lib/plannerAnalysis";
import { computePlannerAnalysis } from "@/lib/plannerAnalysisEngine";

export const authAnalysisService: IAnalysisService = {
  async getAnalysis() {
    return authGetPlannerAnalysis();
  },
};

export function createGuestAnalysisService(): IAnalysisService {
  return {
    async getAnalysis(data: StudentPlanningData) {
      return computePlannerAnalysis(data);
    },
  };
}

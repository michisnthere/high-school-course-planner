import type { RequirementResolution } from "@/lib/api";
import type { IResolutionsService } from "./types";
import {
  getResolutions as authGetResolutions,
  createResolution as authCreateResolution,
  deleteResolution as authDeleteResolution,
} from "@/lib/api";

export const authResolutionsService: IResolutionsService = {
  getResolutions: (): Promise<RequirementResolution[]> => authGetResolutions(),
  createResolution: (data: { type: RequirementResolution["type"]; courseId?: number; metadata?: Record<string, unknown> }): Promise<RequirementResolution> =>
    authCreateResolution(data),
  deleteResolution: (id: number): Promise<void> => authDeleteResolution(id),
};

export function createGuestResolutionsService(): IResolutionsService {
  let nextId = 1;
  const resolutions: RequirementResolution[] = [];

  return {
    async getResolutions(): Promise<RequirementResolution[]> {
      return resolutions.map((r) => ({ ...r }));
    },

    async createResolution(data: { type: RequirementResolution["type"]; courseId?: number; metadata?: Record<string, unknown> }): Promise<RequirementResolution> {
      const id = nextId++;
      const entry: RequirementResolution = {
        id,
        userId: -1,
        type: data.type,
        courseId: data.courseId ?? null,
        metadata: (data.metadata ?? {}) as Record<string, unknown>,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      resolutions.push(entry);
      return { ...entry };
    },

    async deleteResolution(id: number): Promise<void> {
      const idx = resolutions.findIndex((r) => r.id === id);
      if (idx !== -1) resolutions.splice(idx, 1);
    },
  };
}

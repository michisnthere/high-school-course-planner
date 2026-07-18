"use client";

import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import type { IPlannerService, ICompletedCoursesService, ISavedCoursesService, IAnalysisService, IResolutionsService } from "./types";
import { authPlannerService, createGuestPlannerService } from "./planner";
import { authCompletedCoursesService, createGuestCompletedCoursesService } from "./completedCourses";
import { authSavedCoursesService, createGuestSavedCoursesService } from "./savedCourses";
import { authAnalysisService, createGuestAnalysisService } from "./analysis";
import { authResolutionsService, createGuestResolutionsService } from "./resolutions";

type ServiceBundle = {
  planner: IPlannerService;
  completedCourses: ICompletedCoursesService;
  savedCourses: ISavedCoursesService;
  analysis: IAnalysisService;
  resolutions: IResolutionsService;
};

const authBundle: ServiceBundle = {
  planner: authPlannerService,
  completedCourses: authCompletedCoursesService,
  savedCourses: authSavedCoursesService,
  analysis: authAnalysisService,
  resolutions: authResolutionsService,
};

const ServiceContext = createContext<ServiceBundle | null>(null);

export function ServiceProvider({ children }: { children: ReactNode }) {
  const { mode } = useAuth();
  const renderRef = React.useRef(0);
  renderRef.current++;

  const guestBundle = useMemo(() => {
    const result = mode === "guest" ? {
      planner: createGuestPlannerService(),
      completedCourses: createGuestCompletedCoursesService(),
      savedCourses: createGuestSavedCoursesService(),
      analysis: createGuestAnalysisService(),
      resolutions: createGuestResolutionsService(),
    } : null;
    if (typeof window !== "undefined") (window as any).__authMode = mode;
    return result;
  }, [mode]);

  const value = useMemo(() => {
    const kind = mode === "guest" && guestBundle ? "guest" : "auth";
    console.log(`[SvcProv value] mode=${mode} hasGuest=${!!guestBundle} → ${kind}Bundle`);
    return kind === "guest" ? guestBundle : authBundle;
  }, [mode, guestBundle]);

  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  );
}

export function usePlannerService(): IPlannerService {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error("usePlannerService must be used within a ServiceProvider");
  return ctx.planner;
}

export function useCompletedCoursesService(): ICompletedCoursesService {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error("useCompletedCoursesService must be used within a ServiceProvider");
  return ctx.completedCourses;
}

export function useSavedCoursesService(): ISavedCoursesService {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error("useSavedCoursesService must be used within a ServiceProvider");
  return ctx.savedCourses;
}

export function useResolutionsService(): IResolutionsService {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error("useResolutionsService must be used within a ServiceProvider");
  return ctx.resolutions;
}

export function useAnalysisService(): IAnalysisService {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error("useAnalysisService must be used within a ServiceProvider");
  return ctx.analysis;
}

export function useServices(): ServiceBundle {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error("useServices must be used within a ServiceProvider");
  return ctx;
}

export type { ServiceBundle };

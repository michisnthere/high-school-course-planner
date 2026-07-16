"use client";

import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import type { IPlannerService, ICompletedCoursesService, ISavedCoursesService } from "./types";
import { authPlannerService, createGuestPlannerService } from "./planner";
import { authCompletedCoursesService, createGuestCompletedCoursesService } from "./completedCourses";
import { authSavedCoursesService, createGuestSavedCoursesService } from "./savedCourses";

type ServiceBundle = {
  planner: IPlannerService;
  completedCourses: ICompletedCoursesService;
  savedCourses: ISavedCoursesService;
};

const authBundle: ServiceBundle = {
  planner: authPlannerService,
  completedCourses: authCompletedCoursesService,
  savedCourses: authSavedCoursesService,
};

const ServiceContext = createContext<ServiceBundle | null>(null);

export function ServiceProvider({ children }: { children: ReactNode }) {
  const { mode } = useAuth();
  const [guestBundle, setGuestBundle] = useState<ServiceBundle | null>(null);

  useEffect(() => {
    if (mode === "guest") {
      setGuestBundle({
        planner: createGuestPlannerService(),
        completedCourses: createGuestCompletedCoursesService(),
        savedCourses: createGuestSavedCoursesService(),
      });
    } else {
      setGuestBundle(null);
    }
  }, [mode]);

  const value = useMemo(() => {
    if (mode === "guest" && guestBundle) {
      return guestBundle;
    }
    return authBundle;
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

export function useServices(): ServiceBundle {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error("useServices must be used within a ServiceProvider");
  return ctx;
}

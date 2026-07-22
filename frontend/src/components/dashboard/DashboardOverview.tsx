"use client";

import React, { useEffect, useState } from "react";
import { useServices } from "@/services/ServiceContext";
import { YearOverviewCard } from "./YearOverviewCard";
import { breakpoints } from "@/lib/responsive";
import type { Planner } from "@/lib/planner";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";

const ALL_YEARS = [9, 10, 11, 12];

export function DashboardOverview(): React.ReactElement {
  const services = useServices();
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const plannersData = await services.planner.getPlanners();
        if (cancelled) return;
        setPlanners(plannersData);

        try {
          const analysisData = await services.analysis.getAnalysis({
            planners: plannersData,
            completedCourses: [],
            resolutions: [],
            allCourses: [],
          });
          if (!cancelled) setAnalysis(analysisData);
        } catch {
          // analysis unavailable — cards shown without status
        }
      } catch {
        if (!cancelled) setPlanners([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [services]);

  if (loading) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
        Loading your four-year plan...
      </p>
    );
  }

  return (
    <>
      <style>{`
        .dash-year-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .dash-year-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
      <div className="dash-year-grid">
        {ALL_YEARS.map((year) => {
          const planner = planners.find((p) => p.schoolYear === year);
          const yr = analysis?.yearRequirements.find((r) => r.grade === year);

          return (
            <YearOverviewCard
              key={year}
              planner={
                planner ?? {
                  id: 0,
                  schoolYear: year,
                  label: `${year}`,
                  completedAt: null,
                  plannedCourses: [],
                }
              }
              yearAnalysis={
                yr
                  ? {
                      satisfiedCount: yr.satisfiedCount,
                      totalCount: yr.totalCount,
                      items: yr.items.map((i) => ({
                        category: i.category,
                        met: i.met,
                        earnedCredits: i.earnedCredits,
                        requiredCredits: i.requiredCredits,
                      })),
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </>
  );
}

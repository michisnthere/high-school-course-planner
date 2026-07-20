"use client";

import React, { useEffect, useState } from "react";
import { usePlannerService } from "@/services/ServiceContext";
import { YearOverviewCard } from "./YearOverviewCard";
import { breakpoints } from "@/lib/responsive";
import type { Planner } from "@/lib/planner";

const ALL_YEARS = [9, 10, 11, 12];

export function DashboardOverview(): React.ReactElement {
  const plannerService = usePlannerService();
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    plannerService
      .getPlanners()
      .then(setPlanners)
      .catch(() => setPlanners([]))
      .finally(() => setLoading(false));
  }, [plannerService]);

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
          if (!planner) {
            return (
              <YearOverviewCard
                key={year}
                planner={{
                  id: 0,
                  schoolYear: year,
                  label: `${year}`,
                  plannedCourses: [],
                }}
              />
            );
          }
          return <YearOverviewCard key={year} planner={planner} />;
        })}
      </div>
    </>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useServices } from "@/services/ServiceContext";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { YearOverviewCard } from "@/components/dashboard/YearOverviewCard";
import { breakpoints } from "@/lib/responsive";
import type { Planner } from "@/lib/planner";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";

const ALL_YEARS = [9, 10, 11, 12];

export default function PlannerPage(): React.ReactElement {
  return <PlannerContent />;
}

const signInButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  padding: "8px 20px",
  fontSize: "15px",
  fontWeight: 500,
  color: "#FFFFFF",
  backgroundColor: "var(--brand-accent)",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  textDecoration: "none",
  boxSizing: "border-box",
};

function PlannerContent(): React.ReactElement {
  const { mode, loading: authLoading } = useAuth();
  const services = useServices();
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mode) return;
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
          // analysis unavailable
        }
      } catch {
        if (!cancelled) setPlanners([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [services, mode]);

  if (authLoading) {
    return (
      <ResponsivePage>
        <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
          Loading...
        </p>
      </ResponsivePage>
    );
  }

  if (!mode) {
    return (
      <ResponsivePage>
        <div
          style={{
            padding: "24px",
            backgroundColor: "var(--bg-card)",
            borderRadius: "12px",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Plan your four years.
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "15px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Sign in to create and save your planner.
            <br />
            Your planner will be securely stored and synced across devices.
          </p>
          <a href="/login" style={signInButtonStyle}>
            Sign In
          </a>
        </div>
      </ResponsivePage>
    );
  }

  return (
    <ResponsivePage>
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        My Planner
      </h1>
      <p
        style={{
          margin: "0 0 28px",
          fontSize: "16px",
          color: "var(--text-secondary)",
        }}
      >
        Review your four-year plan and edit individual years.
      </p>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
          Loading your four-year plan...
        </p>
      ) : (
        <>
          <style>{`
            .planner-year-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
            }
            @media (max-width: ${breakpoints.mobile - 1}px) {
              .planner-year-grid {
                grid-template-columns: 1fr;
                gap: 16px;
              }
            }
          `}</style>
          <div className="planner-year-grid">
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
      )}
    </ResponsivePage>
  );
}

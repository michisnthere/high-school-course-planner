"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useServices } from "@/services/ServiceContext";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { YearOverviewCard } from "@/components/dashboard/YearOverviewCard";
import { breakpoints } from "@/lib/responsive";
import type { Planner } from "@/lib/planner";
import type { GradeCompleted } from "@/lib/completedCourses";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";

const ALL_YEARS = [9, 10, 11, 12];
const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

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
  const [confirmPlanner, setConfirmPlanner] = useState<Planner | null>(null);
  const [markingPlannerId, setMarkingPlannerId] = useState<number | null>(null);

  useEffect(() => {
    if (!mode) return;
    let cancelled = false;

    async function load() {
      try {
        const plannersData = await services.planner.getPlanners();
        const completedCourses = await services.completedCourses.getCompletedCourses().catch(() => []);
        if (cancelled) return;
        setPlanners(plannersData);

        try {
          const analysisData = await services.analysis.getAnalysis({
            planners: plannersData,
            completedCourses,
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

  const GRADE_LABELS: Record<number, GradeCompleted> = {
    9: "Freshman (9)",
    10: "Sophomore (10)",
    11: "Junior (11)",
    12: "Senior (12)",
  };

  async function handleConfirmMarkCompleted() {
    if (!confirmPlanner) return;
    setMarkingPlannerId(confirmPlanner.id);
    try {
      const updated = await services.planner.markYearCompleted(confirmPlanner.id);
      const nextPlanners = planners.map((p) => (p.id === updated.id ? updated : p));

      if (mode === "guest") {
        const gradeCompleted = GRADE_LABELS[confirmPlanner.schoolYear];
        const seen = new Set<number>();
        for (const pc of confirmPlanner.plannedCourses) {
          if (pc.courseId != null && !seen.has(pc.courseId)) {
            seen.add(pc.courseId);
            await services.completedCourses.addCompletedCourse(
              pc.courseId, gradeCompleted, null, pc.course
            ).catch(() => {});
          }
        }
      }

      const completedCourses = await services.completedCourses.getCompletedCourses().catch(() => []);
      setPlanners(nextPlanners);
      setAnalysis(await services.analysis.getAnalysis({
        planners: nextPlanners,
        completedCourses,
        resolutions: [],
        allCourses: [],
      }).catch(() => analysis));
      setConfirmPlanner(null);
    } finally {
      setMarkingPlannerId(null);
    }
  }

  if (authLoading) {
    return (
      <ResponsivePage>
        <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
          Loading your four-year plan...
        </p>
      </ResponsivePage>
    );
  }

  if (!mode) {
    return (
      <ResponsivePage>
        <h1
          style={{
            margin: "0 0 16px",
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.2,
          }}
        >
          Planner
        </h1>
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
            Sign in to save and manage your four-year course plan.
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "15px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
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
                  onMarkCompleted={setConfirmPlanner}
                  markingCompleted={markingPlannerId === planner?.id}
                />
              );
            })}
          </div>
          {confirmPlanner && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                backgroundColor: "rgba(0, 0, 0, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
              }}
              onClick={() => setConfirmPlanner(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  width: "100%",
                  maxWidth: "440px",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "12px",
                  padding: "24px",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.24)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ margin: "0 0 12px", fontSize: "20px", color: "var(--text-primary)" }}>
                  Mark {YEAR_LABELS[confirmPlanner.schoolYear]} Year as completed?
                </h2>
                <p style={{ margin: "0 0 20px", fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  This will move all planned courses into your completed courses.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setConfirmPlanner(null)}
                    disabled={markingPlannerId != null}
                    style={{
                      minHeight: "44px",
                      padding: "8px 16px",
                      border: "1px solid var(--border-default)",
                      borderRadius: "8px",
                      backgroundColor: "transparent",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMarkCompleted}
                    disabled={markingPlannerId != null}
                    style={{
                      minHeight: "44px",
                      padding: "8px 16px",
                      border: "1px solid #166534",
                      borderRadius: "8px",
                      backgroundColor: "#166534",
                      color: "#ffffff",
                      fontWeight: 700,
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </ResponsivePage>
  );
}

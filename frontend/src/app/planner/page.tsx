"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useServices } from "@/services/ServiceContext";
import { useTranslation } from "@/context/I18nContext";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { GuestEmptyState } from "@/components/auth/GuestEmptyState";
import { YearOverviewCard } from "@/components/dashboard/YearOverviewCard";
import { breakpoints } from "@/lib/responsive";
import type { Planner } from "@/lib/planner";
import type { GradeCompleted } from "@/lib/completedCourses";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";

const ALL_YEARS = [9, 10, 11, 12];

export default function PlannerPage(): React.ReactElement {
  return <PlannerContent />;
}

function PlannerContent(): React.ReactElement {
  const { mode, loading: authLoading } = useAuth();
  const services = useServices();
  const { t } = useTranslation();
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmPlanner, setConfirmPlanner] = useState<Planner | null>(null);
  const [confirmActivePlanner, setConfirmActivePlanner] = useState<Planner | null>(null);
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
    9: t("year.9WithGrade") as GradeCompleted,
    10: t("year.10WithGrade") as GradeCompleted,
    11: t("year.11WithGrade") as GradeCompleted,
    12: t("year.12WithGrade") as GradeCompleted,
  };

  async function handleConfirmMarkCompleted() {
    if (!confirmPlanner) return;
    if (confirmPlanner.completedAt != null) {
      setConfirmPlanner(null);
      return;
    }
    setMarkingPlannerId(confirmPlanner.id);
    try {
      const updated = await services.planner.markYearCompleted(confirmPlanner.id);
      const nextPlanners = planners.map((p) => (p.id === updated.id ? updated : p));

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

  async function handleConfirmMarkActive() {
    if (!confirmActivePlanner) return;
    if (confirmActivePlanner.completedAt == null) {
      setConfirmActivePlanner(null);
      return;
    }
    setMarkingPlannerId(confirmActivePlanner.id);
    try {
      const updated = await services.planner.unmarkYearCompleted(confirmActivePlanner.id);
      const nextPlanners = planners.map((p) => (p.id === updated.id ? updated : p));
      setPlanners(nextPlanners);
      const completedCourses = await services.completedCourses.getCompletedCourses().catch(() => []);

      setAnalysis(await services.analysis.getAnalysis({
        planners: nextPlanners,
        completedCourses,
        resolutions: [],
        allCourses: [],
      }).catch(() => analysis));
      setConfirmActivePlanner(null);
    } catch (e) {
      console.warn("[handleConfirmMarkActive] Failed to unmark year:", e);
    } finally {
      setMarkingPlannerId(null);
    }
  }

  if (authLoading) {
    return (
      <ResponsivePage>
        <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
          {t("planner.loading")}
        </p>
      </ResponsivePage>
    );
  }

  if (!mode) {
    return (
      <GuestEmptyState
        title={t("planner.guestTitle")}
        description={t("planner.guestDescription")}
      />
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
        {t("planner.heading")}
      </h1>
      <p
        style={{
          margin: "0 0 28px",
          fontSize: "16px",
          color: "var(--text-secondary)",
        }}
      >
        {t("planner.description")}
      </p>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
          {t("planner.loading")}
        </p>
      ) : (
        <>
          <style>{`
            .planner-year-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              max-width: 1200px;
              margin: 0 auto;
              width: 100%;
              box-sizing: border-box;
            }
            .planner-year-grid > * {
              min-width: 0;
            }
            @media (max-width: ${breakpoints.tablet}px) {
              .planner-year-grid {
                gap: 20px;
              }
            }
            @media (max-width: ${breakpoints.mobile - 1}px) {
              .planner-year-grid {
                grid-template-columns: 1fr;
                gap: 16px;
              }
            }
          `}</style>
          <div className="planner-year-grid" data-tour="planner-years">
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
                  onMarkActive={setConfirmActivePlanner}
                  markingActive={markingPlannerId === planner?.id}
                />
              );
            })}
          </div>
          {confirmActivePlanner && (
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
              onClick={() => setConfirmActivePlanner(null)}
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
                  {t("planner.markActiveTitle", { yearLabel: t(`year.${confirmActivePlanner.schoolYear}`) })}
                </h2>
                <p style={{ margin: "0 0 20px", fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {t("planner.markActiveDescription")}
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setConfirmActivePlanner(null)}
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
                    {t("planner.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMarkActive}
                    disabled={markingPlannerId != null}
                    style={{
                      minHeight: "44px",
                      padding: "8px 16px",
                      border: "1px solid var(--border-default)",
                      borderRadius: "8px",
                      backgroundColor: "var(--bg-input)",
                      color: "var(--text-primary)",
                      fontWeight: 700,
                    }}
                  >
                    {t("planner.restore")}
                  </button>
                </div>
              </div>
            </div>
          )}
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
                  {t("planner.markCompletedTitle", { yearLabel: t(`year.${confirmPlanner.schoolYear}`) })}
                </h2>
                <p style={{ margin: "0 0 20px", fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {t("planner.markCompletedDescription")}
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
                    {t("planner.cancel")}
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
                    {t("planner.confirm")}
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

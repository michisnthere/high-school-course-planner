"use client";

import React, { Suspense, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ServiceProvider, useServices } from "@/services/ServiceContext";
import { courseToPlannerDetails } from "@/lib/planner";
import { getCourses } from "@/lib/api";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";
import type { PlannerCourseDetails } from "@/lib/planner";
import { computeEffectivePeStatus, type PeSemesterStatus } from "@/lib/gradeRequirements";
import { RecommendedCourseCard } from "@/components/requirements/RecommendedCourseCard";
import { CourseListModal } from "@/components/requirements/CourseListModal";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { breakpoints } from "@/lib/responsive";

const REQUIREMENTS_TO_HIDE = new Set([
  "Science",
  "Social Studies",
  "Required Electives and P.E.",
  "Additional Credits and P.E.",
  "Total Credits",
  "External Credits",
  "46th Credit",
]);

const TOTAL_REQUIRED_CREDITS = 45;

export default function RequirementsPage(): React.ReactElement {
  return (
    <ServiceProvider>
      <Suspense fallback={null}>
        <RequirementsContent />
      </Suspense>
    </ServiceProvider>
  );
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; light: string; textColor: string }> = {
  satisfied: {
    label: "Satisfied",
    badge: "#275D38",
    light: "#E4EFE8",
    textColor: "#ffffff",
  },
  partial: {
    label: "Partial",
    badge: "#ECBA2B",
    light: "#FCF5DF",
    textColor: "#111827",
  },
  notStarted: {
    label: "Not Started",
    badge: "#ef4444",
    light: "#fef2f2",
    textColor: "#ffffff",
  },
};

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function RequirementsContent(): React.ReactElement {
  const { mode, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const services = useServices();
  const { planner: plannerService, completedCourses: completedService, resolutions: resolutionsService, analysis: analysisService } = services;
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<PlannerAnalysis["informationItems"][number] | null>(null);
  const [viewAllReq, setViewAllReq] = useState<string | null>(null);
  const [allCourseDetails, setAllCourseDetails] = useState<PlannerCourseDetails[]>([]);

  const loadIdRef = useRef(0);

  // Initialize expandedIds from URL param
  const initialIds = React.useMemo(() => {
    const raw = searchParams.get("expanded");
    if (!raw) return new Set<number>();
    return new Set(raw.split(",").map(Number).filter((n) => !isNaN(n)));
  }, []);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(initialIds);
  const isFirstRender = useRef(true);
  const { isMobile } = useBreakpoint();

  const load = useCallback(async () => {
    if (!mode) return;
    const id = ++loadIdRef.current;
    const svcName = (plannerService as any).constructor?.name ?? (plannerService.getPlanners === services.planner.getPlanners ? "auth" : "guest");
    console.log(`[REQ:${id}] load() START | plannerSvc=${svcName} | mode=${(window as any).__authMode ?? "?"}`);
    console.log(`[REQ:${id}] plannerService.getPlanners source:`, plannerService.getPlanners.toString().slice(0, 80));
    try {
      setError(null);
      setLoading(true);
      console.log(`[REQ:${id}] state: loading=true, error=null`);
      const [planners, completedCourses, resolutions, courses] = await Promise.all([
        plannerService.getPlanners(),
        completedService.getCompletedCourses(),
        resolutionsService.getResolutions(),
        getCourses(),
      ]);
      console.log(`[REQ:${id}] ALL fetches succeeded`);
      const allCourses = courses.map(courseToPlannerDetails);
      setAllCourseDetails(allCourses);
      const data = await analysisService.getAnalysis({ planners, completedCourses, resolutions, allCourses });
      setAnalysis(data);
      setError(null);
      console.log(`[REQ:${id}] SUCCESS - analysis loaded`);
    } catch (err) {
      console.log(`[REQ:${id}] CATCH error:`, err instanceof Error ? err.message : err);
      setError(
        err instanceof Error ? err.message : "Failed to load graduation requirements"
      );
    } finally {
      console.log(`[REQ:${id}] FINALLY - set loading=false`);
      setLoading(false);
    }
  }, [analysisService, plannerService, completedService, resolutionsService, mode]);

  useEffect(() => {
    console.log("useEffect[load] FIRED - load identity changed");
    load();
  }, [load]);

  useEffect(() => {
    console.log(`[REQ:state] loading=${loading} error=${error?.slice(0,40)} analysis=${!!analysis}`);
  });

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Sync expandedIds to URL (skipping initial mount to avoid overwriting URL params)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const ids = Array.from(expandedIds);
    const params = new URLSearchParams(searchParams.toString());
    if (ids.length > 0) {
      params.set("expanded", ids.join(","));
    } else {
      params.delete("expanded");
    }
    const target = params.toString() ? `/requirements?${params.toString()}` : "/requirements";
    router.replace(target, { scroll: false });
  }, [expandedIds, searchParams, router]);

  // Restore scroll position from sessionStorage after data loads
  useEffect(() => {
    if (!analysis) return;
    const saved = sessionStorage.getItem("requirements-scroll");
    if (saved) {
      sessionStorage.removeItem("requirements-scroll");
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
    }
  }, [analysis]);

  const saveScroll = useCallback(() => {
    sessionStorage.setItem("requirements-scroll", String(window.scrollY));
  }, []);

  const hasPeWaiver = analysis?.resolutions?.some((r) => r.type === "pe_waiver") ?? false;
  const visibleRequirements = analysis?.graduationRequirements.filter(
    (req) => !REQUIREMENTS_TO_HIDE.has(req.name)
  ) ?? [];
  const visibleInformationItems = analysis?.informationItems.filter(
    (item) => !item.name.toLowerCase().includes("46th") && !item.name.toLowerCase().includes("external credits")
  ) ?? [];

  if (authLoading) {
    return (
      <div style={{ padding: "32px", minHeight: "calc(100vh - 64px)" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!mode) {
    return (
      <div style={{ padding: "32px", minHeight: "calc(100vh - 64px)" }}>
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
            Track your graduation progress.
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "15px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Sign in to monitor your graduation requirements and completed credits.
            <br />
            Your progress will be securely stored and synced across devices.
          </p>
          <a
            href="/login"
            style={{
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
            }}
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
          <style>{`
        .rs-req-year-body,
        .rs-req-card-body-inner {
          max-height: 0;
          overflow: hidden;
          transition: max-height 350ms ease, opacity 250ms ease, margin 250ms ease;
          opacity: 0;
        }
        .rs-req-year-body.open,
        .rs-req-card-body-inner.open {
          max-height: 2000px;
          opacity: 1;
        }
        .rs-req-year-body.open {
          margin-top: 16px;
        }
      `}</style>
      {isMobile && <style>{`
        .rs-req-page {
          padding: 16px;
          padding-top: 0;
          padding-bottom: calc(16px + var(--safe-area-bottom));
          padding-left: calc(16px + var(--safe-area-left));
          padding-right: calc(16px + var(--safe-area-right));
        }
        .rs-req-back {
          display: inline-block;
          position: sticky;
          top: calc(56px + var(--safe-area-top, 0px));
          z-index: 40;
          background: var(--bg-page);
          padding: 8px 0 4px;
          margin-bottom: 0;
          font-size: 14px;
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          cursor: pointer;
          border: none;
        }
        .rs-req-page h1 {
          margin: 12px 0 20px !important;
          font-size: 1.5rem !important;
        }
        .rs-req-progress {
          position: sticky;
          top: calc(80px + var(--safe-area-top, 0px));
          z-index: 39;
          background: var(--bg-page);
          padding: 8px 0 12px;
          margin: 0 !important;
        }
        .rs-req-progress strong {
          font-size: 1.25rem;
        }
        .rs-req-progress span {
          font-size: 1rem !important;
        }
        .rs-req-grid {
          grid-template-columns: 1fr !important;
        }
        .rs-req-recs {
          gap: 10px !important;
        }
        .rs-req-recs-link {
          padding: 14px 16px !important;
          font-size: 15px !important;
          min-height: 48px;
          display: flex !important;
          align-items: center;
        }
        .rs-req-recs-link > div {
          flex-wrap: wrap;
          gap: 4px;
        }
        .rs-req-explore {
          width: 100% !important;
          padding: 14px 16px !important;
          font-size: 15px !important;
          min-height: 48px;
          display: flex !important;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }
        .rs-req-info-grid {
          grid-template-columns: 1fr !important;
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-req-year-card {
            padding: 16px !important;
          }
          .rs-req-year-card h3 {
            font-size: 16px !important;
          }
          .rs-req-card {
            padding: 16px 16px 16px 20px !important;
          }
          .rs-req-card h3 {
            font-size: 15px !important;
          }
          .rs-req-card .rs-req-stats {
            gap: 10px !important;
            font-size: 13px !important;
          }
          .rs-req-card .rs-req-stats strong {
            font-size: 13px;
          }
        }
      `}</style>}
      <div
        className={isMobile ? "rs-req-page" : undefined}
        style={
          isMobile
            ? { minHeight: "calc(100vh - 64px)" }
            : { padding: "32px", minHeight: "calc(100vh - 64px)" }
        }
      >
        {isMobile && (
          <button
            type="button"
            className="rs-req-back"
            onClick={() => router.back()}
          >
            ← Back
          </button>
        )}

        <h1
          style={{
            margin: "0 0 28px",
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.2,
          }}
        >
          Graduation Progress
        </h1>

        {loading ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading graduation requirements...</p>
        ) : error ? (
          <p style={{ color: "#ef4444" }}>{error}</p>
        ) : !analysis || visibleRequirements.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>
            No graduation requirements found. Requirements are populated from the course catalog.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {analysis.credits.total > 0 && isMobile ? (
              <div className="rs-req-progress">
                <strong style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                  {formatNumber(analysis.credits.total)}{" "}
                  <span style={{ fontSize: "22px", fontWeight: 400, color: "var(--text-muted)" }}>
                    / {TOTAL_REQUIRED_CREDITS} Credits Completed
                  </span>
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  {formatNumber(Math.max(0, TOTAL_REQUIRED_CREDITS - analysis.credits.total))} credits remaining
                </p>
              </div>
            ) : analysis.credits.total > 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  lineHeight: 1.3,
                }}
              >
                {formatNumber(analysis.credits.total)}{" "}
                <span style={{ fontSize: "22px", fontWeight: 400, color: "var(--text-muted)" }}>
                  / {TOTAL_REQUIRED_CREDITS} Credits Completed
                </span>
              </p>
            ) : null}

            <section>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Year-Level Requirements
              </h2>
              <p style={{ margin: "-12px 0 16px", fontSize: "14px", color: "var(--text-muted)" }}>
                Am I meeting this year&apos;s requirements?
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {analysis.yearRequirements.map((year) => {
                  const gradeStart = (year.grade - 9) * 2 + 1;
                  const peSemesters = analysis.peSemesterBreakdown
                    .filter((s) => s.semester >= gradeStart && s.semester < gradeStart + 2)
                    .map((s) => ({
                      semester: s.semester - (year.grade - 9) * 2,
                      isMet: s.met,
                      courseTitle: s.courseTitle,
                      requiredLabel: s.requiredLabel,
                    }));
                  const peWaivers = analysis.resolutions
                    .filter((r) => r.type === "pe_waiver")
                    .map((r) => ({ type: r.type }));
                  const effectivePe = computeEffectivePeStatus(peSemesters, peWaivers);
                  return (
                    <YearLevelCardView
                      key={year.grade}
                      year={year}
                      pePerSemester={effectivePe}
                      defaultExpanded={false}
                    />
                  );
                })}
              </div>
            </section>

            <section>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Graduation Requirements
              </h2>
              <p style={{ margin: "-12px 0 16px", fontSize: "14px", color: "var(--text-muted)" }}>
                Am I on track to graduate?
              </p>
              <div
                className={isMobile ? "rs-req-grid" : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "16px",
                  alignItems: "start",
                }}
              >
                {visibleRequirements.map((req) => (
                  <RequirementCard
                    key={req.id}
                    req={req}
                    isExpanded={expandedIds.has(req.id)}
                    onToggle={() => toggleExpand(req.id)}
                    hasPeWaiver={hasPeWaiver}
                    expandedIds={expandedIds}
                    onNavigate={saveScroll}
                    allCourseDetails={allCourseDetails}
                    onViewAll={() => setViewAllReq(req.name)}
                  />
                ))}
              </div>
            </section>

            {visibleInformationItems.length > 0 && (
              <section>
                <h2
                  style={{
                    margin: "0 0 16px",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  Helpful Information
                </h2>
                <div
                  className={isMobile ? "rs-req-info-grid" : undefined}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {visibleInformationItems.map((item) => (
                    <InfoCard
                      key={item.id}
                      item={item}
                      onOpen={() => setModalItem(item)}
                    />
                  ))}
                   {modalItem && (
                    <InfoModal
                      item={modalItem}
                      onClose={() => setModalItem(null)}
                    />
                  )}
                </div>
              </section>
            )}

            {viewAllReq && allCourseDetails.length > 0 && (
              <CourseListModal
                requirementName={viewAllReq}
                courses={allCourseDetails.filter((c) =>
                  (c.fulfillsRequirements ?? []).some(
                    (r) => r.trim().toLowerCase() === viewAllReq.trim().toLowerCase()
                  )
                )}
                returnParams={Array.from(expandedIds).join(",")}
                onClose={() => setViewAllReq(null)}
                onNavigate={saveScroll}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

type YearLevelCardProps = {
  year: PlannerAnalysis["yearRequirements"][number];
  pePerSemester: PeSemesterStatus[];
  defaultExpanded?: boolean;
};

function YearLevelCardView({ year, pePerSemester, defaultExpanded = false }: YearLevelCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const peItem = pePerSemester.length > 0
    ? {
        category: "Physical Education",
        required: true,
        met: pePerSemester.every((s) => s.isMet),
        earnedCredits: pePerSemester.filter((s) => s.isMet).length,
        requiredCredits: pePerSemester.length,
        matches: [],
      }
    : null;
  const allItems = peItem ? [...year.items, peItem] : year.items;
  const satisfiedCount = allItems.filter((i) => i.met).length;
  const totalCount = allItems.length;
  const allMet = satisfiedCount === totalCount;
  const statusLabel = allMet ? "Satisfied" : "Partial";
  const statusColor = allMet ? "#275D38" : "#ECBA2B";

  return (
    <div
      className="rs-req-year-card"
      style={{
        padding: "18px 20px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
              {year.label}
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              {satisfiedCount}/{totalCount} requirements met
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <span style={{ color: statusColor, fontSize: "18px", fontWeight: 400 }}>
              {allMet ? "\u2713" : "\u26A0"}
            </span>
            <span
              aria-hidden="true"
              style={{
                color: "var(--text-muted)",
                fontSize: "14px",
                transition: "transform 200ms ease",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              {"\u25BC"}
            </span>
          </div>
        </div>
      </button>

      <div style={{ marginTop: "10px", fontSize: "13px", color: statusColor, fontWeight: 600 }}>
        {statusLabel}
      </div>

      <div className={`rs-req-year-body ${expanded ? "open" : ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {allItems.map((item) => (
            <div
              key={item.category}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                padding: "12px",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "8px",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {item.category}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  {formatNumber(item.earnedCredits)} / {formatNumber(item.requiredCredits)} credits
                </p>
              </div>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: item.met ? "var(--status-success)" : "var(--status-warning)",
                  whiteSpace: "nowrap",
                }}
              >
                {item.met ? "Satisfied" : "Missing"}
              </span>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}

function getCourseSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type RequirementCardProps = {
  req: PlannerAnalysis["graduationRequirements"][number];
  isExpanded: boolean;
  onToggle: () => void;
  hasPeWaiver: boolean;
  expandedIds: Set<number>;
  onNavigate: () => void;
  allCourseDetails: PlannerCourseDetails[];
  onViewAll: () => void;
};

function RequirementCard({
  req,
  isExpanded,
  onToggle,
  hasPeWaiver,
  expandedIds,
  onNavigate,
  allCourseDetails,
  onViewAll,
}: RequirementCardProps): React.ReactElement {
  const isPe = req.name.toLowerCase() === "physical education";
  const config = STATUS_CONFIG[req.status];
  const effectiveRequired = isPe && hasPeWaiver ? 0 : (req.requiredValue ?? 0);
  const effectiveEarned = isPe && hasPeWaiver ? effectiveRequired : req.earnedValue;
  const percent =
    effectiveRequired > 0
      ? Math.min(100, (effectiveEarned / effectiveRequired) * 100)
      : effectiveRequired === 0 && isPe && hasPeWaiver
      ? 100
      : req.status === "satisfied"
      ? 100
      : 0;

  const recommended = req.recommendedCourses ?? [];
  const showRecs = recommended.length > 0;
  const resolvedRecs = recommended
    .map((r) => allCourseDetails.find((c) => c.id === r.courseId))
    .filter((c): c is PlannerCourseDetails => c != null);
  const displayRecs = resolvedRecs.slice(0, 3);
  const hasMore = resolvedRecs.length > 3;

  return (
    <div
      className="rs-req-card"
      style={{
        position: "relative",
        padding: "20px 20px 20px 24px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: "4px",
          backgroundColor: config.badge,
        }}
      />
      <div onClick={onToggle} style={{ cursor: "pointer" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.3,
            }}
          >
            {req.name}
            {isPe && hasPeWaiver && <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--status-success)", fontWeight: 600 }}>(Waived)</span>}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <span
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 600,
                color: config.textColor ?? "#ffffff",
                backgroundColor: config.badge,
                borderRadius: "9999px",
              }}
            >
              {config.label}
            </span>
            <span
              aria-hidden="true"
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                transition: "transform 200ms ease",
                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              {"\u25B6"}
            </span>
          </div>
        </div>
        <div
          className="rs-req-stats"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            fontSize: "14px",
            color: "var(--text-muted)",
            marginBottom: "12px",
          }}
        >
          <span>
            Earned:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{formatNumber(effectiveEarned)}</strong>
          </span>
          <span>
            Required:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{formatNumber(effectiveRequired)}</strong>
          </span>
          <span>
            Remaining:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{formatNumber(Math.max(0, effectiveRequired - effectiveEarned))}</strong>
          </span>
        </div>
        <ProgressBar percent={percent} color={config.badge} showLabel />
      </div>

      <div className={`rs-req-card-body-inner ${isExpanded ? "open" : ""}`}>
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-light)",
          }}
        >
          {req.requiredValue != null && (
            <p style={{ margin: "0 0 12px", fontSize: "14px", color: "var(--text-muted)" }}>
              This requirement requires {formatNumber(req.requiredValue)} credits.
              You have earned {formatNumber(req.earnedValue)} credits so far.
            </p>
          )}
          {showRecs && (
            <div>
              <p style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                Recommended Courses
              </p>
              <div className="rs-req-recs" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {displayRecs.map((course) => {
                  const courseReturnParams = Array.from(expandedIds).join(",");
                  return (
                    <RecommendedCourseCard
                      key={course.id}
                      course={course}
                      requirementName={req.name}
                      returnParams={courseReturnParams}
                      onNavigate={onNavigate}
                    />
                  );
                })}
                {hasMore && (
                    <button
                      type="button"
                      onClick={onViewAll}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "10px 14px",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "var(--brand-accent)",
                        textDecoration: "none",
                        border: "1px solid var(--brand-accent)",
                        borderRadius: "8px",
                        backgroundColor: "var(--brand-accent-light)",
                        cursor: "pointer",
                        minHeight: "44px",
                        transition: "opacity 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                    >
                      View All ({recommended.length})
                    </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type InfoCardProps = {
  item: PlannerAnalysis["informationItems"][number];
  onOpen: () => void;
};

function InfoCard({ item, onOpen }: InfoCardProps): React.ReactElement {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "20px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
        cursor: "pointer",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        outline: "none",
        boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
        borderColor: hovered ? "var(--brand-accent)" : "var(--border-default)",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.3,
        }}
      >
        {item.name}
      </h3>
      {item.explanation && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "14px",
            color: "var(--text-muted)",
            lineHeight: 1.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.explanation}
        </p>
      )}
    </div>
  );
}

function InfoModal({
  item,
  onClose,
}: {
  item: PlannerAnalysis["informationItems"][number];
  onClose: () => void;
}): React.ReactElement {
  const { isMobile: mobile } = useBreakpoint();

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {mobile && <style>{`
        @keyframes info-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>}
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          display: "flex",
          alignItems: mobile ? "flex-end" : "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: mobile ? 0 : "32px",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: mobile ? "100%" : "560px",
            width: "100%",
            maxHeight: mobile ? "100%" : "80vh",
            height: mobile ? "100%" : "auto",
            overflowY: "auto",
            backgroundColor: "var(--bg-card)",
            borderRadius: mobile ? 0 : "12px",
            padding: mobile ? "calc(24px + var(--safe-area-top, 0px)) 24px calc(24px + var(--safe-area-bottom, 0px))" : "28px",
            position: "relative",
            animation: mobile ? "info-slide-up 0.25s ease-out" : undefined,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: mobile ? "44px" : "36px",
                height: mobile ? "44px" : "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "8px",
                backgroundColor: "var(--bg-muted)",
                color: "var(--text-muted)",
                fontSize: "18px",
                fontWeight: 500,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              {"\u2715"}
            </button>
          </div>
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: mobile ? "20px" : "22px",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.3,
            }}
          >
            {item.name}
          </h2>
          {item.explanation && (
            <p
              style={{
                margin: "0 0 16px",
                fontSize: mobile ? "15px" : "15px",
                color: "var(--text-secondary)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {item.explanation}
            </p>
          )}
          {item.sourceReference && (
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              Source: {item.sourceReference}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function ProgressBar({
  percent,
  color = "var(--brand-accent)",
  height = 8,
  showLabel = false,
}: {
  percent: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
}): React.ReactElement {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const clamped = Math.min(100, Math.max(0, percent));

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(clamped), 50);
    return () => clearTimeout(timer);
  }, [clamped]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div
        style={{
          flex: 1,
          height,
          backgroundColor: "var(--border-default)",
          borderRadius: height / 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${animatedWidth}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: height / 2,
            transition: "width 800ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
      {showLabel && (
        <span
          style={{
            fontSize: "13px",
            fontWeight: 400,
            color: "var(--text-secondary)",
            minWidth: "42px",
            textAlign: "right",
          }}
        >
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getPlannerAnalysis, type PlannerAnalysis } from "@/lib/plannerAnalysis";
import { getCourses } from "@/lib/api";
import { getCompletedCourses, type CompletedCourse } from "@/lib/completedCourses";
import {
  getPlanners,
  courseToPlannerDetails,
  type Planner,
  type PlannerCourseDetails,
} from "@/lib/planner";
import { computeYearLevelCards, computePeYears, type YearLevelCard, type PeYearStatus } from "@/lib/yearLevelValidation";
import type { Course } from "@/types/course";

export default function RequirementsPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <RequirementsContent />
    </ProtectedRoute>
  );
}

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

const STATUS_CONFIG = {
  satisfied: {
    label: "Satisfied",
    badge: "#10b981",
    light: "#ecfdf5",
  },
  partial: {
    label: "Partial",
    badge: "#f59e0b",
    light: "#fffbeb",
  },
  notStarted: {
    label: "Not Started",
    badge: "#ef4444",
    light: "#fef2f2",
  },
};

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function RequirementsContent(): React.ReactElement {
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [courses, setCourses] = useState<PlannerCourseDetails[]>([]);
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [modalItem, setModalItem] = useState<PlannerAnalysis["informationItems"][number] | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [analysisData, rawCourses, completedData, plannerData] = await Promise.all([
        getPlannerAnalysis(),
        getCourses(),
        getCompletedCourses(),
        getPlanners(),
      ]);
      setAnalysis(analysisData);
      setCourses((rawCourses as Course[]).map(courseToPlannerDetails));
      setCompletedCourses(completedData);
      setPlanners(plannerData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load graduation requirements"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const completedIds = useMemo(
    () => new Set(completedCourses.map((c) => c.courseId)),
    [completedCourses]
  );

  const plannedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const planner of planners) {
      for (const pc of planner.plannedCourses ?? []) {
        if (pc.courseId != null) {
          ids.add(pc.courseId);
        }
      }
    }
    return ids;
  }, [planners]);

  const yearCards = useMemo(
    () => computeYearLevelCards(planners, completedCourses, courses),
    [planners, completedCourses, courses]
  );

  const peYearStatuses = useMemo(
    () => computePeYears(planners, completedCourses, courses),
    [planners, completedCourses, courses]
  );

  const peYearsMet = peYearStatuses.filter((y) => y.met).length;

  const creditSummary = useMemo(() => {
    const completedCredits = completedCourses.reduce(
      (sum, cc) => sum + (cc.credits ?? cc.course.credits ?? cc.course.duration ?? 0),
      0
    );
    const plannedCredits = planners.reduce(
      (sum, p) =>
        sum +
        (p.plannedCourses ?? []).reduce(
          (s, pc) => s + (pc.course?.credits ?? pc.course?.duration ?? 0),
          0
        ),
      0
    );
    const earned = completedCredits + plannedCredits;
    const totalReq =
      analysis?.graduationRequirements.find(
        (r) => r.name.toLowerCase() === "total credits"
      )?.requiredValue ?? 0;
    return { earned, required: totalReq };
  }, [completedCourses, planners, analysis]);

  return (
    <div
      style={{
        padding: "32px",
        fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`,
        minHeight: "calc(100vh - 64px)",
      }}
    >
      <h1
        style={{
          margin: "0 0 28px",
          fontSize: "32px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
        }}
      >
        Graduation Requirements
      </h1>

      {loading ? (
        <p style={{ color: "#d1d5db" }}>Loading graduation requirements...</p>
      ) : error ? (
        <p style={{ color: "#ef4444" }}>{error}</p>
      ) : !analysis || analysis.graduationRequirements.length === 0 ? (
        <p style={{ color: "#9ca3af" }}>
          No graduation requirements found. Requirements are populated from the course catalog.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {creditSummary.required > 0 && (
            <div
              style={{
                padding: "24px",
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                marginBottom: "12px",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: "14px",
                  color: "#6b7280",
                  fontWeight: 500,
                }}
              >
                {formatNumber(creditSummary.required)} Credit Requirement
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {formatNumber(creditSummary.earned)}{" "}
                <span style={{ fontSize: "24px", fontWeight: 400, color: "#6b7280" }}>
                  / {formatNumber(creditSummary.required)} credits
                </span>
              </p>
            </div>
          )}

          <section>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: "20px",
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              Year-Level Requirements
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {yearCards.map((year) => (
                <YearLevelCardView key={year.grade} card={year} />
              ))}
              <PeYearsCard
                peYearStatuses={peYearStatuses}
                peYearsMet={peYearsMet}
                totalYears={4}
              />
            </div>
          </section>

          <section>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: "20px",
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              Graduation Requirements
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "16px",
              }}
            >
              {analysis.graduationRequirements.map((req) => (
                <RequirementCard
                  key={req.id}
                  req={req}
                  isExpanded={expandedIds.has(req.id)}
                  onToggle={() => toggleExpand(req.id)}
                />
              ))}
            </div>
          </section>

          {analysis.informationItems.length > 0 && (
            <section>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                Helpful Information
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "16px",
                }}
              >
                {analysis.informationItems.map((item) => (
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
        </div>
      )}
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
        backgroundColor: hovered ? "#f9fafb" : "#ffffff",
        borderRadius: "12px",
        cursor: "pointer",
        transition: "background-color 0.15s ease",
        outline: "none",
        border: hovered ? "1px solid #e5e7eb" : "1px solid transparent",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "16px",
          fontWeight: 600,
          color: "#111827",
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
            color: "#6b7280",
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
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: "32px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "560px",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          padding: "28px",
          position: "relative",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: "8px",
            backgroundColor: "#f3f4f6",
            color: "#6b7280",
            fontSize: "18px",
            fontWeight: 700,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "22px",
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.3,
            paddingRight: "40px",
          }}
        >
          {item.name}
        </h2>

        {item.explanation && (
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "15px",
              color: "#374151",
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
              color: "#9ca3af",
            }}
          >
            Source: {item.sourceReference}
          </p>
        )}
      </div>
    </div>
  );
}

type RequirementCardProps = {
  req: PlannerAnalysis["graduationRequirements"][number];
  isExpanded: boolean;
  onToggle: () => void;
};

type YearLevelCardProps = {
  card: YearLevelCard;
};

function YearLevelCardView({ card }: YearLevelCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const allMet = card.satisfiedCount === card.totalCount;
  const hasWarnings = card.items.some((item) => item.status === "warning");
  const statusLabel = allMet ? "Satisfied" : hasWarnings ? "Warning" : "Missing";
  const statusColor = allMet ? "#10b981" : hasWarnings ? "#f59e0b" : "#ef4444";
  const statusMark = allMet ? "✓" : hasWarnings ? "!" : "•";

  return (
    <div
      style={{
        padding: "18px 20px",
        backgroundColor: "#ffffff",
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
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>
              {card.label}
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#6b7280" }}>
              {card.satisfiedCount}/{card.totalCount} requirements met
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <span style={{ color: statusColor, fontSize: "18px", fontWeight: 700 }}>{statusMark}</span>
            <span
              aria-hidden="true"
              style={{
                color: "#6b7280",
                transition: "transform 200ms ease",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              ▶
            </span>
          </div>
        </div>
      </button>

      <div style={{ marginTop: "10px", fontSize: "13px", color: statusColor, fontWeight: 600 }}>
        {statusLabel}
      </div>

      {expanded && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {card.items.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                padding: "12px 0",
                borderTop: "1px solid #f3f4f6",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                  {item.label}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
                  {item.detail}
                </p>
                {item.recommendations.length > 0 && item.status !== "satisfied" && (
                  <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151" }}>
                    Recommended: {item.recommendations.join(", ")}
                  </p>
                )}
              </div>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: item.status === "satisfied" ? "#10b981" : item.status === "warning" ? "#f59e0b" : "#ef4444",
                  whiteSpace: "nowrap",
                }}
              >
                {item.status === "satisfied" ? "Satisfied" : item.status === "warning" ? "Warning" : "Missing"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequirementCard({
  req,
  isExpanded,
  onToggle,
}: RequirementCardProps): React.ReactElement {
  const config = STATUS_CONFIG[req.status];
  const percent =
    (req.requiredValue ?? 0) > 0
      ? Math.min(100, (req.earnedValue / (req.requiredValue ?? 0)) * 100)
      : req.status === "satisfied"
      ? 100
      : 0;

  return (
    <div
      style={{
        position: "relative",
        padding: "20px 20px 20px 24px",
        backgroundColor: "#ffffff",
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
              fontWeight: 600,
              color: "#111827",
              lineHeight: 1.3,
            }}
          >
            {req.name}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <span
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#ffffff",
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
                color: "#6b7280",
                transition: "transform 200ms ease",
                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              ▶
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            fontSize: "14px",
            color: "#6b7280",
            marginBottom: "12px",
          }}
        >
          <span>
            Earned:{" "}
            <strong style={{ color: "#111827" }}>{formatNumber(req.earnedValue)}</strong>
          </span>
          <span>
            Required:{" "}
            <strong style={{ color: "#111827" }}>{formatNumber(req.requiredValue ?? 0)}</strong>
          </span>
          <span>
            Remaining:{" "}
            <strong style={{ color: "#111827" }}>{formatNumber(req.remainingValue)}</strong>
          </span>
        </div>
        <ProgressBar percent={percent} color={config.badge} showLabel />
      </div>

      {isExpanded && req.requiredValue != null && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid #f3f4f6",
          }}
        >
          <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
            This requirement requires {formatNumber(req.requiredValue)} credits.
            You have earned {formatNumber(req.earnedValue)} credits so far.
          </p>
        </div>
      )}
    </div>
  );
}

function ProgressBar({
  percent,
  color = "#2563eb",
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
          backgroundColor: "#e5e7eb",
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
            fontWeight: 600,
            color: "#374151",
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

function PeYearsCard({
  peYearStatuses,
  peYearsMet,
  totalYears,
}: {
  peYearStatuses: PeYearStatus[];
  peYearsMet: number;
  totalYears: number;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const allMet = peYearsMet === totalYears;
  const statusColor = allMet ? "#10b981" : "#ef4444";
  const statusMark = allMet ? "✓" : "•";

  return (
    <div
      style={{
        padding: "18px 20px",
        backgroundColor: "#ffffff",
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
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>
              Physical Education
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#6b7280" }}>
              {peYearsMet}/{totalYears} years met
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <span style={{ color: statusColor, fontSize: "18px", fontWeight: 700 }}>{statusMark}</span>
            <span
              aria-hidden="true"
              style={{
                color: "#6b7280",
                transition: "transform 200ms ease",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              ▶
            </span>
          </div>
        </div>
      </button>

      <div style={{ marginTop: "10px", fontSize: "13px", color: statusColor, fontWeight: 600 }}>
        {allMet ? "Satisfied" : `${totalYears - peYearsMet} year(s) remaining`}
      </div>

      {expanded && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
            Each year requires two semesters of Physical Education division courses, an approved
            waiver, or a dance option.
          </p>
          {peYearStatuses.map((year) => (
            <div
              key={year.grade}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                padding: "10px 0",
                borderTop: "1px solid #f3f4f6",
              }}
            >
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                {year.label}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: year.met ? "#10b981" : "#ef4444",
                }}
              >
                {year.met ? "Met" : "Not met"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



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

const COURSE_STATUS_COLORS = {
  completed: "#10b981",
  planned: "#2563eb",
  notYetTaken: "#6b7280",
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
      for (const pc of planner.plannedCourses) {
        if (pc.courseId != null) {
          ids.add(pc.courseId);
        }
      }
    }
    return ids;
  }, [planners]);

  const summary = useMemo(() => {
    if (!analysis) return null;
    const earned = analysis.graduationRequirements.reduce(
      (sum, req) => sum + req.earnedValue,
      0
    );
    const required = analysis.graduationRequirements.reduce(
      (sum, req) => sum + (req.requiredValue ?? 0),
      0
    );
    const remaining = Math.max(0, required - earned);
    const percentage = required > 0 ? Math.round((earned / required) * 100) : 0;
    return { earned, required, remaining, percentage };
  }, [analysis]);

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
          {summary && (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <SummaryCard title="Overall Completion" value={`${summary.percentage}%`}>
                <div style={{ marginTop: "8px" }}>
                  <ProgressBar percent={summary.percentage} height={10} showLabel />
                </div>
              </SummaryCard>
              <SummaryCard title="Credits Earned" value={formatNumber(summary.earned)} />
              <SummaryCard title="Credits Required" value={formatNumber(summary.required)} />
              <SummaryCard title="Remaining Credits" value={formatNumber(summary.remaining)} />
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
                  courses={courses}
                  completedIds={completedIds}
                  plannedIds={plannedIds}
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
                Information
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "16px",
                }}
              >
                {analysis.informationItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "20px",
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
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
                  </div>
                ))}
              </div>
            </section>
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
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              {analysis.yearRequirements.map((year) => (
                <div
                  key={year.grade}
                  style={{
                    padding: "20px",
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 14px",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {YEAR_LABELS[year.grade]}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <YearRequirementRow label="English" status={year.english} />
                    <YearRequirementRow label="Math" status={year.math} />
                    <YearRequirementRow label="Science" status={year.science} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

type RequirementCardProps = {
  req: PlannerAnalysis["graduationRequirements"][number];
  courses: PlannerCourseDetails[];
  completedIds: Set<number>;
  plannedIds: Set<number>;
  isExpanded: boolean;
  onToggle: () => void;
};

function RequirementCard({
  req,
  courses,
  completedIds,
  plannedIds,
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

  const reqCourses = useMemo(() => {
    const name = req.name.toLowerCase();
    return courses
      .filter((c) => c.fulfillsRequirements.some((r) => r.toLowerCase() === name))
      .sort((a, b) => {
        const aCompleted = completedIds.has(a.id);
        const aPlanned = plannedIds.has(a.id);
        const bCompleted = completedIds.has(b.id);
        const bPlanned = plannedIds.has(b.id);
        const aPriority = aCompleted ? 0 : aPlanned ? 1 : 2;
        const bPriority = bCompleted ? 0 : bPlanned ? 1 : 2;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.title.localeCompare(b.title);
      });
  }, [courses, req.name, completedIds, plannedIds]);

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

      {req.status !== "satisfied" && (
        <div style={{ marginTop: "16px" }}>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#374151",
            }}
          >
            Recommended courses
          </p>
          {req.recommendedCourses.length === 0 ? (
            <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
              No recommended courses available.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {req.recommendedCourses.map((rec) => (
                <div
                  key={rec.courseId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#111827",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={rec.title}
                  >
                    {rec.title}
                  </span>
                  <span style={{ fontSize: "12px", color: "#6b7280", whiteSpace: "nowrap" }}>
                    {rec.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isExpanded && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid #f3f4f6",
          }}
        >
          {reqCourses.length === 0 ? (
            <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
              No catalog courses are linked to this requirement.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {reqCourses.map((course) => (
                <CourseStatusRow
                  key={course.id}
                  course={course}
                  completedIds={completedIds}
                  plannedIds={plannedIds}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type CourseStatusRowProps = {
  course: PlannerCourseDetails;
  completedIds: Set<number>;
  plannedIds: Set<number>;
};

function CourseStatusRow({
  course,
  completedIds,
  plannedIds,
}: CourseStatusRowProps): React.ReactElement {
  const isCompleted = completedIds.has(course.id);
  const isPlanned = plannedIds.has(course.id);
  const isNotYetTaken = !isCompleted && !isPlanned;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        padding: "10px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 500,
            color: "#111827",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={course.title}
        >
          {course.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6b7280" }}>
          {course.credits != null ? `${formatNumber(course.credits)} credits` : "Credits unknown"}
        </p>
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {isCompleted && (
          <StatusBadge label="Completed" color={COURSE_STATUS_COLORS.completed} />
        )}
        {isPlanned && (
          <StatusBadge label="Planned" color={COURSE_STATUS_COLORS.planned} />
        )}
        {isNotYetTaken && (
          <StatusBadge label="Not yet taken" color={COURSE_STATUS_COLORS.notYetTaken} />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }): React.ReactElement {
  return (
    <span
      style={{
        padding: "3px 8px",
        fontSize: "12px",
        fontWeight: 600,
        color: "#ffffff",
        backgroundColor: color,
        borderRadius: "6px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        flex: "1 1 200px",
        minWidth: "180px",
        padding: "20px",
        backgroundColor: "#ffffff",
        borderRadius: "12px",
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#6b7280" }}>{title}</p>
      <p style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: "#111827" }}>
        {value}
      </p>
      {children}
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

function YearRequirementRow({
  label,
  status,
}: {
  label: string;
  status: { required: boolean; met: boolean; earnedCredits: number };
}): React.ReactElement | null {
  if (!status.required) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "15px",
        color: "#374151",
      }}
    >
      <span>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {status.met ? (
          <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
        ) : (
          <span style={{ color: "#ef4444", fontWeight: 700 }}>✗</span>
        )}
        <span style={{ fontSize: "13px", color: "#6b7280" }}>
          {formatNumber(status.earnedCredits)} cr
        </span>
      </span>
    </div>
  );
}

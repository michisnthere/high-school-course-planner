"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getPlannerAnalysis, type PlannerAnalysis } from "@/lib/plannerAnalysis";
import { computeEffectivePeStatus, type PeSemesterStatus } from "@/lib/gradeRequirements";

const REQUIREMENTS_TO_HIDE = new Set([
  "Science",
  "Social Studies",
  "Required Electives and P.E.",
  "Additional Credits and P.E.",
  "Total Credits",
]);

const TOTAL_REQUIRED_CREDITS = 45;

export default function RequirementsPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <RequirementsContent />
      </Suspense>
    </ProtectedRoute>
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<PlannerAnalysis["informationItems"][number] | null>(null);

  // Initialize expandedIds from URL param
  const initialIds = React.useMemo(() => {
    const raw = searchParams.get("expanded");
    if (!raw) return new Set<number>();
    return new Set(raw.split(",").map(Number).filter((n) => !isNaN(n)));
  }, []);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(initialIds);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPlannerAnalysis();
      setAnalysis(data);
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
      // Update URL with expanded state so Back navigation restores it
      const ids = Array.from(next);
      const params = new URLSearchParams(searchParams.toString());
      if (ids.length > 0) {
        params.set("expanded", ids.join(","));
      } else {
        params.delete("expanded");
      }
      const target = params.toString() ? `/requirements?${params.toString()}` : "/requirements";
      router.replace(target, { scroll: false });
      return next;
    });
  }, [router, searchParams]);

  const hasPeWaiver = analysis?.resolutions?.some((r) => r.type === "pe_waiver") ?? false;
  const visibleRequirements = analysis?.graduationRequirements.filter(
    (req) => !REQUIREMENTS_TO_HIDE.has(req.name)
  ) ?? [];
  const visibleInformationItems = analysis?.informationItems.filter(
    (item) => !item.name.toLowerCase().includes("46th")
  ) ?? [];

  return (
    <div
      style={{
        padding: "32px",
        minHeight: "calc(100vh - 64px)",
      }}
    >
      <h1
        style={{
          margin: "0 0 28px",
          fontSize: "32px",
          fontWeight: 700,
          color: "#111827",
          lineHeight: 1.2,
        }}
      >
        Graduation Progress
      </h1>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading graduation progress...</p>
      ) : error ? (
        <p style={{ color: "#ef4444" }}>{error}</p>
      ) : !analysis || visibleRequirements.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>
          No graduation requirements found. Requirements are populated from the course catalog.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {analysis.credits.total > 0 && (
            <p
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 700,
                color: "#111827",
                lineHeight: 1.3,
              }}
            >
              {formatNumber(analysis.credits.total)}{" "}
              <span style={{ fontSize: "22px", fontWeight: 400, color: "#6b7280" }}>
                / {TOTAL_REQUIRED_CREDITS} Credits Completed
              </span>
            </p>
          )}

          <section>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: "20px",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Year-Level Requirements
            </h2>
            <p style={{ margin: "-12px 0 16px", fontSize: "14px", color: "#6b7280" }}>
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
                color: "#111827",
              }}
            >
              Graduation Requirements
            </h2>
            <p style={{ margin: "-12px 0 16px", fontSize: "14px", color: "#6b7280" }}>
              Am I on track to graduate?
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "16px",
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
                  color: "#111827",
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
        </div>
      )}
    </div>
  );
}

type YearLevelCardProps = {
  year: PlannerAnalysis["yearRequirements"][number];
  pePerSemester: PeSemesterStatus[];
};

function YearLevelCardView({ year, pePerSemester }: YearLevelCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const allMet = year.satisfiedCount === year.totalCount;
  const statusLabel = allMet ? "Satisfied" : "Partial";
  const statusColor = allMet ? "#275D38" : "#ECBA2B";

  return (
    <div
      style={{
        padding: "18px 20px",
        backgroundColor: "#ffffff",
        border: "2px solid #275D38",
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
              {year.label}
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#6b7280" }}>
              {year.satisfiedCount}/{year.totalCount} requirements met
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <span style={{ color: statusColor, fontSize: "18px", fontWeight: 400 }}>
              {allMet ? "\u2713" : "\u26A0"}
            </span>
            <span
              aria-hidden="true"
              style={{
                color: "#6b7280",
                transition: "transform 200ms ease",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              {"\u25B6"}
            </span>
          </div>
        </div>
      </button>

      <div style={{ marginTop: "10px", fontSize: "13px", color: statusColor, fontWeight: 600 }}>
        {statusLabel}
      </div>

      {expanded && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {year.items.map((item) => (
            <div
              key={item.category}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                padding: "12px",
                backgroundColor: "#ffffff",
                border: "1px solid #ECBA2B",
                borderRadius: "8px",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                  {item.category}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
                  {formatNumber(item.earnedCredits)} / {formatNumber(item.requiredCredits)} credits
                </p>
              </div>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: item.met ? "#275D38" : "#ECBA2B",
                  whiteSpace: "nowrap",
                }}
              >
                {item.met ? "Satisfied" : "Missing"}
              </span>
            </div>
          ))}
          {pePerSemester.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                Physical Education
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {pePerSemester.map((sem) => (
                  <div
                    key={sem.semester}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: sem.isMet ? "#6b7280" : "#ECBA2B",
                    }}
                  >
                    <span>Semester {sem.semester}</span>
                    <span>
                      {sem.isMet ? "\u2713" : "\u26A0"}{" "}
                      {sem.courseTitle ?? "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
};

function RequirementCard({
  req,
  isExpanded,
  onToggle,
  hasPeWaiver,
  expandedIds,
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
  const displayRecs = recommended.slice(0, 3);
  const hasMore = recommended.length > 3;

  return (
    <div
      style={{
        position: "relative",
        padding: "20px 20px 20px 24px",
        backgroundColor: "#ffffff",
        border: "2px solid #275D38",
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
              color: "#111827",
              lineHeight: 1.3,
            }}
          >
            {req.name}
            {isPe && hasPeWaiver && <span style={{ marginLeft: "8px", fontSize: "12px", color: "#275D38", fontWeight: 600 }}>(Waived)</span>}
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
                color: "#6b7280",
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
            <strong style={{ color: "#111827" }}>{formatNumber(effectiveEarned)}</strong>
          </span>
          <span>
            Required:{" "}
            <strong style={{ color: "#111827" }}>{formatNumber(effectiveRequired)}</strong>
          </span>
          <span>
            Remaining:{" "}
            <strong style={{ color: "#111827" }}>{formatNumber(Math.max(0, effectiveRequired - effectiveEarned))}</strong>
          </span>
        </div>
        <ProgressBar percent={percent} color={config.badge} showLabel />
      </div>

      {isExpanded && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid #f3f4f6",
          }}
        >
          {req.requiredValue != null && (
            <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#6b7280" }}>
              This requirement requires {formatNumber(req.requiredValue)} credits.
              You have earned {formatNumber(req.earnedValue)} credits so far.
            </p>
          )}
          {showRecs && (
            <div>
              <p style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                Recommended Courses
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {displayRecs.map((course) => {
                  const courseReturnParams = new URLSearchParams();
                  const expandedArr = Array.from(expandedIds);
                  if (expandedArr.length > 0) {
                    courseReturnParams.set("expanded", expandedArr.join(","));
                  }
                  const courseReturnStr = courseReturnParams.toString();
                  const courseHref = `/catalog/${getCourseSlug(course.title)}?return=${encodeURIComponent(courseReturnStr ? `/requirements?${courseReturnStr}` : "/requirements")}`;
                  return (
                  <Link
                    key={course.courseId}
                    href={courseHref}
                    style={{
                      display: "block",
                      padding: "10px 14px",
                      backgroundColor: "#FCF5DF",
                      border: "1px solid #ECBA2B",
                      borderRadius: "8px",
                      textDecoration: "none",
                      color: "#111827",
                      fontSize: "14px",
                      fontWeight: 500,
                      transition: "border-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#d4a01e"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#ECBA2B"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{course.title}</span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>{course.reason}</span>
                    </div>
                  </Link>
                );
              })}
                {hasMore && (
                  <Link
                    href={`/catalog?division=${encodeURIComponent(req.name)}`}
                    style={{
                      display: "inline-block",
                      padding: "10px 14px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#ECBA2B",
                      textDecoration: "none",
                      textAlign: "center",
                      border: "1px solid #ECBA2B",
                      borderRadius: "8px",
                      backgroundColor: "#FCF5DF",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#d4a01e"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#ECBA2B"; }}
                  >
                    Explore More {"\u2192"}
                  </Link>
                )}
              </div>
            </div>
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
        backgroundColor: "#ffffff",
        border: "2px solid #ECBA2B",
        borderRadius: "12px",
        cursor: "pointer",
        transition: "box-shadow 0.15s ease",
        outline: "none",
        boxShadow: hovered ? "0 2px 8px rgba(236, 186, 43, 0.2)" : "none",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "16px",
          fontWeight: 700,
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
            fontWeight: 500,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          {"\u2715"}
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
            fontWeight: 400,
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

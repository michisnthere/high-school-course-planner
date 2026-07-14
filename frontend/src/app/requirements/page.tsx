"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getPlannerAnalysis, type PlannerAnalysis } from "@/lib/plannerAnalysis";

export default function RequirementsPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <RequirementsContent />
    </ProtectedRoute>
  );
}

const STATUS_CONFIG = {
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
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [modalItem, setModalItem] = useState<PlannerAnalysis["informationItems"][number] | null>(null);

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
      return next;
    });
  }, []);

  const hasPeWaiver = analysis?.resolutions?.some((r) => r.type === "pe_waiver") ?? false;

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
      ) : !analysis || analysis.graduationRequirements.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>
          No graduation requirements found. Requirements are populated from the course catalog.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {analysis.credits.total > 0 && (
            <div
              style={{
                padding: "24px",
                backgroundColor: "#ffffff",
                border: "2px solid #275D38",
                borderRadius: "12px",
                marginBottom: "12px",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: "14px",
                  color: "#6b7280",
                  fontWeight: 600,
                }}
              >
                Credit Progress
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "32px",
                  fontWeight: 400,
                  color: "#111827",
                }}
              >
                {formatNumber(analysis.credits.total)}{" "}
                <span style={{ fontSize: "24px", fontWeight: 400, color: "#6b7280" }}>
                  credits earned
                </span>
              </p>
            </div>
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
              {analysis.yearRequirements.map((year) => (
                <YearLevelCardView key={year.grade} year={year} />
              ))}
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
              {analysis.graduationRequirements.map((req) => (
                <RequirementCard
                  key={req.id}
                  req={req}
                  isExpanded={expandedIds.has(req.id)}
                  onToggle={() => toggleExpand(req.id)}
                  hasPeWaiver={hasPeWaiver}
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

type YearLevelCardProps = {
  year: PlannerAnalysis["yearRequirements"][number];
};

function YearLevelCardView({ year }: YearLevelCardProps): React.ReactElement {
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
              {allMet ? "✓" : "!"}
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
        </div>
      )}
    </div>
  );
}

type RequirementCardProps = {
  req: PlannerAnalysis["graduationRequirements"][number];
  isExpanded: boolean;
  onToggle: () => void;
  hasPeWaiver: boolean;
};

function RequirementCard({
  req,
  isExpanded,
  onToggle,
  hasPeWaiver,
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

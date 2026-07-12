"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getPlannerAnalysis, type PlannerAnalysis } from "@/lib/plannerAnalysis";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                <ProgressBar percent={summary.percentage} />
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
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              {analysis.graduationRequirements.map((req) => {
                const config = STATUS_CONFIG[req.status];
                return (
                  <div
                    key={req.id}
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
                      <span
                        style={{
                          flexShrink: 0,
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
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "16px",
                        fontSize: "14px",
                        color: "#6b7280",
                      }}
                    >
                      <span>
                        Earned:{" "}
                        <strong style={{ color: "#111827" }}>
                          {formatNumber(req.earnedValue)}
                        </strong>
                      </span>
                      <span>
                        Required:{" "}
                        <strong style={{ color: "#111827" }}>
                          {formatNumber(req.requiredValue ?? 0)}
                        </strong>
                      </span>
                      <span>
                        Remaining:{" "}
                        <strong style={{ color: "#111827" }}>
                          {formatNumber(req.remainingValue)}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
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

function ProgressBar({ percent }: { percent: number }): React.ReactElement {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      style={{
        marginTop: "12px",
        height: "8px",
        backgroundColor: "#e5e7eb",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: "100%",
          backgroundColor: "#2563eb",
          borderRadius: "4px",
          transition: "width 300ms ease",
        }}
      />
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

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getGpaProjection, type GpaProjection } from "@/lib/gpaProjection";

function formatGpa(value: number): string {
  return value.toFixed(2);
}

export function AcademicSnapshot(): React.ReactElement {
  const [projection, setProjection] = useState<GpaProjection | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getGpaProjection();
      setProjection(data);
    } catch {
      setProjection(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => {
      load();
    };
    window.addEventListener("planner:changed", handler);
    window.addEventListener("completed-courses:changed", handler);
    return () => {
      window.removeEventListener("planner:changed", handler);
      window.removeEventListener("completed-courses:changed", handler);
    };
  }, [load]);

  const current = projection?.current ?? { weighted: 0, unweighted: 0, credits: 0 };
  const projected = projection?.projected ?? { weighted: 0, unweighted: 0, credits: 0 };

  return (
    <div
      style={{
        flex: 1,
        minWidth: "300px",
        padding: "24px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "20px",
        fontWeight: 700,
        color: "var(--text-primary)",
        }}
      >
        GPA Projection
      </h2>

      {loading && !projection ? (
        <p style={{ margin: 0, fontSize: "15px", color: "var(--text-muted)" }}>Loading GPA projection...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <ProjectionBlock
            title="Current GPA"
            weighted={current.weighted}
            unweighted={current.unweighted}
            creditsLabel="Credits Completed"
            credits={current.credits}
          />
          <ProjectionBlock
            title="Projected GPA"
            weighted={projected.weighted}
            unweighted={projected.unweighted}
          />
        </div>
      )}
      <p
        style={{
          margin: "16px 0 0",
          fontSize: "13px",
          lineHeight: "1.5",
          color: "var(--text-muted)",
        }}
      >
        Your projected GPA is calculated using your completed courses and planned coursework. The
        projection updates as you adjust your four-year plan, including course selection and
        difficulty level.
      </p>
    </div>
  );
}

function ProjectionBlock({
  title,
  weighted,
  unweighted,
  creditsLabel,
  credits,
}: {
  title: string;
  weighted: number;
  unweighted: number;
  creditsLabel?: string;
  credits?: number;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>{title}</p>
      <MetricRow label="Weighted" value={formatGpa(weighted)} />
      <MetricRow label="Unweighted" value={formatGpa(unweighted)} />
      {creditsLabel !== undefined && credits !== undefined && (
        <MetricRow label={creditsLabel} value={credits.toFixed(1)} />
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "15px", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "15px", fontWeight: 400, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

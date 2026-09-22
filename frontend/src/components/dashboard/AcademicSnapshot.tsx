"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getGpaProjection, type GpaProjection } from "@/lib/gpaProjection";
import { formatCredits } from "@/lib/courseCredits";
import { useTranslation } from "@/context/I18nContext";

function formatGpa(value: number): string {
  return value.toFixed(2);
}

export function AcademicSnapshot(): React.ReactElement {
  const { t } = useTranslation();
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
        {t("dashboard.gpaProjection")}
      </h2>

      {loading && !projection ? (
        <p style={{ margin: 0, fontSize: "15px", color: "var(--text-muted)" }}>{t("dashboard.loadingGpa")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <ProjectionBlock
            title={t("dashboard.currentGpa")}
            weighted={current.weighted}
            unweighted={current.unweighted}
            creditsLabel={t("dashboard.creditsCompleted")}
            credits={current.credits}
          />
          <ProjectionBlock
            title={t("dashboard.projectedGpa")}
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
        {t("dashboard.gpaDescription")}
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
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>{title}</p>
      <MetricRow label={t("dashboard.weighted")} value={formatGpa(weighted)} />
      <MetricRow label={t("dashboard.unweighted")} value={formatGpa(unweighted)} />
      {creditsLabel !== undefined && credits !== undefined && (
        <MetricRow label={creditsLabel} value={formatCredits(credits)} />
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

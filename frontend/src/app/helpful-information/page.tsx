"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { ServiceProvider, useServices } from "@/services/ServiceContext";
import { courseToPlannerDetails } from "@/lib/planner";
import { getCourses } from "@/lib/api";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";
import type { PlannerCourseDetails } from "@/lib/planner";
import type { CompletedCourse } from "@/lib/completedCourses";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { GuestEmptyState } from "@/components/auth/GuestEmptyState";

export default function HelpfulInformationPage(): React.ReactElement {
  return (
    <ServiceProvider>
      <Suspense fallback={null}>
        <HelpfulInformationContent />
      </Suspense>
    </ServiceProvider>
  );
}

function HelpfulInformationContent(): React.ReactElement {
  const { mode, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { planner: plannerService, completedCourses: completedService, resolutions: resolutionsService, analysis: analysisService } = useServices();
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<PlannerAnalysis["informationItems"][number] | null>(null);
  const { isMobile } = useBreakpoint();

  const load = useCallback(async () => {
    if (!mode) return;
    try {
      setError(null);
      setLoading(true);
      const [planners, completedCourses, resolutions, courses] = await Promise.all([
        plannerService.getPlanners(),
        completedService.getCompletedCourses(),
        resolutionsService.getResolutions(),
        getCourses(),
      ]);
      const allCourses: PlannerCourseDetails[] = courses.map(courseToPlannerDetails);
      const data = await analysisService.getAnalysis({ planners, completedCourses, resolutions, allCourses });
      setAnalysis(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("requirements.loadError")
      );
    } finally {
      setLoading(false);
    }
  }, [analysisService, plannerService, completedService, resolutionsService, mode]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleInformationItems = analysis?.informationItems.filter(
    (item) => !item.name.toLowerCase().includes("46th") && !item.name.toLowerCase().includes("external credits")
  ) ?? [];

  if (authLoading) {
    return (
      <div style={{ padding: "32px", minHeight: "calc(100dvh - 64px)" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
          {t("auth.loading")}
        </p>
      </div>
    );
  }

  if (!mode) {
    return (
      <GuestEmptyState
        title={t("helpfulInformation.guestTitle")}
        description={t("helpfulInformation.guestDescription")}
      />
    );
  }

  return (
    <div
      style={
        isMobile
          ? { padding: "16px", paddingTop: 0, paddingBottom: "calc(16px + var(--safe-area-bottom))", paddingLeft: "calc(16px + var(--safe-area-left))", paddingRight: "calc(16px + var(--safe-area-right))", boxSizing: "border-box" as const, width: "100%", maxWidth: "100%", minWidth: 0, minHeight: "calc(100dvh - 64px)" }
          : { padding: "32px", minHeight: "calc(100dvh - 64px)" }
      }
    >
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: isMobile ? "1.5rem" : "32px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        {t("helpfulInformation.heading")}
      </h1>
      <p style={{ margin: "0 0 28px", fontSize: "14px", color: "var(--text-muted)" }}>
        {t("helpfulInformation.subtitle")}
      </p>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>{t("requirements.loading")}</p>
      ) : error ? (
        <p style={{ color: "#ef4444" }}>{error}</p>
      ) : visibleInformationItems.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>
          {t("helpfulInformation.empty")}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(auto-fill, minmax(300px, 1fr))",
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
      )}
    </div>
  );
}

function InfoCard({ item, onOpen }: { item: PlannerAnalysis["informationItems"][number]; onOpen: () => void }): React.ReactElement {
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
        minWidth: 0,
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
          overflowWrap: "break-word",
          wordBreak: "break-word",
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
  const { t } = useTranslation();

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
              aria-label={t("helpfulInformation.close")}
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
                fontSize: "15px",
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
              {t("requirements.source", { sourceReference: item.sourceReference })}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

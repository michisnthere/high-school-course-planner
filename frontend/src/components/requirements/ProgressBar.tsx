"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "@/context/I18nContext";
import { computeRequirementSegments } from "@/lib/requirementProgress";

export type ProgressBarProps = {
  /** Requirement total, in the requirement's own unit. */
  totalValue?: number;
  /** Portion satisfied by completed courses (green). */
  completedValue?: number;
  /** Additional portion projected to be satisfied by planned courses (yellow). */
  plannedValue?: number;
  height?: number;
  showLabel?: boolean;
};

/**
 * Three-segment graduation requirement progress bar.
 *
 * Renders already-calculated values only: green = completed, yellow = planned,
 * gray = remaining. It knows nothing about how a requirement's credits or
 * course counts were derived.
 */
export function ProgressBar({
  totalValue = 0,
  completedValue = 0,
  plannedValue = 0,
  height = 8,
  showLabel = false,
}: ProgressBarProps): React.ReactElement {
  const { t } = useTranslation();
  const segments = computeRequirementSegments(totalValue, completedValue, plannedValue);
  const projectedPercent =
    segments.totalValue > 0
      ? ((segments.completedValue + segments.plannedValue) / segments.totalValue) * 100
      : 0;
  const [animatedCompleted, setAnimatedCompleted] = useState(0);
  const [animatedPlanned, setAnimatedPlanned] = useState(0);
  const [animatedRemaining, setAnimatedRemaining] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedCompleted(segments.totalValue > 0 ? (segments.completedValue / segments.totalValue) * 100 : 0);
      setAnimatedPlanned(segments.totalValue > 0 ? (segments.plannedValue / segments.totalValue) * 100 : 0);
      setAnimatedRemaining(segments.totalValue > 0 ? (segments.remainingValue / segments.totalValue) * 100 : 0);
    }, 50);
    return () => clearTimeout(timer);
  }, [segments.totalValue, segments.completedValue, segments.plannedValue, segments.remainingValue]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(projectedPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("requirements.progressLabel", { value: String(Math.round(projectedPercent)) })}
        style={{
          flex: 1,
          height,
          backgroundColor: "var(--border-default)",
          borderRadius: height / 2,
          overflow: "hidden",
          display: "flex",
        }}
      >
        {animatedCompleted > 0 && (
          <div
            data-segment="completed"
            style={{
              width: `${animatedCompleted}%`,
              height: "100%",
              backgroundColor: "#275D38",
              borderRight: "1px solid rgba(255, 255, 255, 0.6)",
              boxSizing: "border-box",
              transition: "width 800ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        )}
        {animatedPlanned > 0 && (
          <div
            data-segment="planned"
            style={{
              width: `${animatedPlanned}%`,
              height: "100%",
              backgroundColor: "#ECBA2B",
              borderRight: "1px solid rgba(255, 255, 255, 0.5)",
              boxSizing: "border-box",
              transition: "width 800ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        )}
        {animatedRemaining > 0 && (
          <div
            data-segment="remaining"
            style={{
              width: `${animatedRemaining}%`,
              height: "100%",
              backgroundColor: "#D1D5DB",
              boxSizing: "border-box",
              transition: "width 800ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        )}
        {segments.totalValue === 0 && projectedPercent === 0 && (
          <div
            data-segment="remaining"
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#D1D5DB",
              boxSizing: "border-box",
            }}
          />
        )}
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
          {Math.round(projectedPercent)}%
        </span>
      )}
    </div>
  );
}

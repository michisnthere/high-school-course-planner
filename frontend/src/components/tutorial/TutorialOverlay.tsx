"use client";

import React, { useEffect, useCallback, useRef, useState } from "react";
import { useTutorial } from "@/context/TutorialContext";
import { useTranslation } from "@/context/I18nContext";
import { usePreferences } from "@/context/PreferencesContext";

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

export function TutorialOverlay(): React.ReactElement | null {
  const {
    isOpen,
    currentStep,
    currentChapter,
    currentStepIndex,
    totalSteps,
    chapterStartIndex,
    chapterStepCount,
    stepInChapter,
    hasTarget,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
  } = useTutorial();
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const popupRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isLastStep =
    currentStepIndex === totalSteps - 1;
  const isFirstStep = currentStepIndex === 0;

  // Compute spotlight and popup position when step changes.
  useEffect(() => {
    if (!isOpen || !currentStep) {
      setSpotlightRect(null);
      setPopupStyle({});
      return;
    }

    if (!currentStep.target || !hasTarget) {
      setSpotlightRect(null);
      setPopupStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10002,
      });
      return;
    }

    const el = document.querySelector(currentStep.target.selector);
    if (!el) {
      setSpotlightRect(null);
      setPopupStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10002,
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 8;
    setSpotlightRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Scroll element into view if needed.
    if (currentStep.target.scrollIntoView !== false) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Position popup relative to target.
    const position = currentStep.target.position ?? "bottom";
    const gap = 16;
    const popupWidth = 400;
    const popupMaxWidth = Math.min(popupWidth, window.innerWidth - 32);

    let top: number;
    let left: number;
    let transform = "";

    switch (position) {
      case "top":
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
        transform = "translate(-50%, -100%)";
        break;
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
        transform = "translate(-50%, 0)";
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
        transform = "translate(-100%, -50%)";
        break;
      case "right":
      default:
        top = rect.top + rect.height / 2;
        left = rect.right + gap;
        transform = "translate(0, -50%)";
        break;
    }

    // Clamp to viewport.
    const maxLeft = window.innerWidth - popupMaxWidth - 16;
    const clampedLeft = Math.max(16, Math.min(left, maxLeft));
    if (clampedLeft !== left) {
      transform = transform.replace("translate(-50%", "translate(0");
      left = clampedLeft;
    }

    setPopupStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      transform,
      width: `${popupMaxWidth}px`,
      maxWidth: `${popupMaxWidth}px`,
      zIndex: 10002,
    });
  }, [isOpen, currentStep, hasTarget]);

  // Focus the close button when step changes.
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen, currentStepIndex]);

  // Keyboard navigation.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        skipTutorial();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (isLastStep) {
          completeTutorial();
        } else {
          nextStep();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!isFirstStep) {
          prevStep();
        }
      }
    },
    [isOpen, isFirstStep, isLastStep, nextStep, prevStep, skipTutorial, completeTutorial]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Prevent body scroll when tutorial is open.
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  if (!isOpen || !currentStep) return null;

  const prefersReducedMotion =
    preferences.reducedMotion === "on" ||
    (preferences.reducedMotion === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const overlayTransition = prefersReducedMotion
    ? {}
    : { transition: "opacity 0.2s ease" };

  // Spotlight cutout SVG mask.
  const spotlightClipPath = spotlightRect
    ? `polygon(
        0% 0%, 0% 100%, 100% 100%, 100% 0%,
        ${spotlightRect.left}px ${spotlightRect.top}%,
        ${spotlightRect.left}px ${(spotlightRect.top + spotlightRect.height)}px,
        ${(spotlightRect.left + spotlightRect.width)}px ${(spotlightRect.top + spotlightRect.height)}px,
        ${(spotlightRect.left + spotlightRect.width)}px ${spotlightRect.top}%
      )`
    : undefined;

  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          zIndex: 10000,
          ...overlayTransition,
        }}
        onClick={skipTutorial}
      />

      {/* Spotlight cutout */}
      {spotlightRect && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            pointerEvents: "none",
            boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.6)`,
            borderRadius: "8px",
            top: `${spotlightRect.top}px`,
            left: `${spotlightRect.left}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
            ...overlayTransition,
          }}
        />
      )}

      {/* Popup */}
      <div
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(currentStep.titleKey)}
        style={{
          ...popupStyle,
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          maxWidth: "400px",
          width: "100%",
        }}
      >
        {/* Chapter label */}
        {currentChapter && (
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--brand-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "8px",
            }}
          >
            {t(currentChapter.nameKey)}
          </div>
        )}

        {/* Title */}
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.3,
          }}
        >
          {t(currentStep.titleKey)}
        </h3>

        {/* Description */}
        <div
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: "20px",
          }}
        >
          {t(currentStep.descriptionKey)}
        </div>

        {/* Progress */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            Step {stepInChapter} of {chapterStepCount} in chapter
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            {currentStepIndex + 1} / {totalSteps}
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: "4px",
            backgroundColor: "var(--bg-muted)",
            borderRadius: "2px",
            marginBottom: "20px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
              backgroundColor: "var(--brand-accent)",
              borderRadius: "2px",
              transition: prefersReducedMotion ? "none" : "width 0.3s ease",
            }}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <button
            ref={closeButtonRef}
            onClick={skipTutorial}
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: "8px",
              fontWeight: 500,
            }}
          >
            {t("tutorial.actions.skip")}
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            {!isFirstStep && (
              <button
                onClick={prevStep}
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                {t("tutorial.actions.back")}
              </button>
            )}
            <button
              onClick={isLastStep ? completeTutorial : nextStep}
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "var(--brand-accent)",
                border: "none",
                borderRadius: "8px",
                padding: "8px 20px",
                cursor: "pointer",
              }}
            >
              {isLastStep
                ? t("tutorial.actions.finish")
                : t("tutorial.actions.next")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

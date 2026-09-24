"use client";

import React, { useEffect, useLayoutEffect, useCallback, useRef, useState } from "react";
import { useTutorial } from "@/context/TutorialContext";
import { useTranslation } from "@/context/I18nContext";
import { usePreferences } from "@/context/PreferencesContext";

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

const EDGE_MARGIN = 16;
const POPUP_MAX_WIDTH = 400;
const TARGET_GAP = 12;
const POPUP_PADDING = 24;

export function computePopupPosition(
  targetRect: DOMRect,
  preferredPosition: "top" | "bottom" | "left" | "right",
  popupHeight: number,
  popupWidth: number,
  viewportWidth: number,
  viewportHeight: number
): { top: number; left: number; transform: string; position: string } {
  const vw = viewportWidth;
  const vh = viewportHeight;
  const pw = Math.min(popupWidth, vw - EDGE_MARGIN * 2);
  const ph = popupHeight;

  const spaceAbove = targetRect.top - EDGE_MARGIN;
  const spaceBelow = vh - targetRect.bottom - EDGE_MARGIN;
  const spaceLeft = targetRect.left - EDGE_MARGIN;
  const spaceRight = vw - targetRect.right - EDGE_MARGIN;

  const canFitTop = spaceAbove >= ph;
  const canFitBottom = spaceBelow >= ph;
  const canFitLeft = spaceLeft >= pw;
  const canFitRight = spaceRight >= pw;

  const isSmallScreen = vw < 640;

  let position: "top" | "bottom" | "left" | "right" | "centered" = preferredPosition;

  if (position === "top" && !canFitTop) {
    position = canFitBottom ? "bottom" : canFitRight ? "right" : canFitLeft ? "left" : "centered";
  } else if (position === "bottom" && !canFitBottom) {
    position = canFitTop ? "top" : canFitRight ? "right" : canFitLeft ? "left" : "centered";
  } else if (position === "left" && !canFitLeft) {
    position = canFitRight ? "right" : canFitTop ? "top" : canFitBottom ? "bottom" : "centered";
  } else if (position === "right" && !canFitRight) {
    position = canFitLeft ? "left" : canFitTop ? "top" : canFitBottom ? "bottom" : "centered";
  }

  if (isSmallScreen && position !== "top" && position !== "bottom") {
    if (!canFitLeft && !canFitRight) {
      position = "centered";
    }
  }

  if (position === "centered") {
    const maxTop = Math.max(EDGE_MARGIN, vh - EDGE_MARGIN - ph);
    const maxLeft = Math.max(EDGE_MARGIN, vw - EDGE_MARGIN - pw);
    const top = Math.min(Math.max(EDGE_MARGIN, (vh - ph) / 2), maxTop);
    const left = Math.min(Math.max(EDGE_MARGIN, (vw - pw) / 2), maxLeft);
    return { top, left, transform: "", position: "centered" };
  }

  let top: number;
  let left: number;
  let transform = "";

  switch (position) {
    case "top":
      top = targetRect.top - TARGET_GAP - ph;
      left = targetRect.left + targetRect.width / 2;
      transform = "translate(-50%, 0)";
      break;
    case "bottom":
      top = targetRect.bottom + TARGET_GAP;
      left = targetRect.left + targetRect.width / 2;
      transform = "translate(-50%, 0)";
      break;
    case "left":
      top = targetRect.top + targetRect.height / 2;
      left = targetRect.left - TARGET_GAP - pw;
      transform = "translate(0, -50%)";
      break;
    case "right":
    default:
      top = targetRect.top + targetRect.height / 2;
      left = targetRect.right + TARGET_GAP;
      transform = "translate(0, -50%)";
      break;
  }

  const hasCenterX = transform.includes("translate(-50%");
  const hasCenterY = transform.includes(", -50%)");

  if (hasCenterX) {
    const minLeft = pw / 2 + EDGE_MARGIN;
    const maxLeft = vw - pw / 2 - EDGE_MARGIN;
    left = Math.max(minLeft, Math.min(left, maxLeft));
  } else {
    left = Math.max(EDGE_MARGIN, Math.min(left, vw - EDGE_MARGIN - pw));
  }

  if (hasCenterY) {
    const minTop = ph / 2 + EDGE_MARGIN;
    const maxTop = vh - ph / 2 - EDGE_MARGIN;
    top = Math.max(minTop, Math.min(top, maxTop));
  } else {
    top = Math.max(EDGE_MARGIN, Math.min(top, vh - EDGE_MARGIN - ph));
  }

  return { top, left, transform, position };
}

function getPopupMaxWidth() {
  return Math.min(POPUP_MAX_WIDTH, window.innerWidth - EDGE_MARGIN * 2);
}

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
    isNavigationStep,
    isInteractionStep,
    isAuthStep,
    navigationReady,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
    signInWithTutorial,
  } = useTutorial();
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const popupRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const stepKeyRef = useRef<string>("");

  const isLastStep = currentStepIndex === totalSteps - 1;
  const isFirstStep = currentStepIndex === 0;

  const isNoTarget = !currentStep?.target || !hasTarget;

  // Phase 1: Set spotlight and initial popup position when step changes.
  useEffect(() => {
    if (!isOpen || !currentStep) {
      setSpotlightRect(null);
      setPopupStyle({});
      return;
    }

    if (isNoTarget) {
      setSpotlightRect(null);
      setPopupStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10002,
        pointerEvents: "auto",
      });
      return;
    }

    const el = document.querySelector(currentStep.target!.selector);
    if (!el) {
      setSpotlightRect(null);
      setPopupStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10002,
        pointerEvents: "auto",
      });
      return;
    }

    const padding = 8;

    const updateSpotlight = () => {
      const currentEl = document.querySelector(currentStep!.target!.selector);
      if (!currentEl) return;
      const rect = currentEl.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    };

    // Set initial spotlight immediately so the overlay appears without delay.
    updateSpotlight();

    const key = `${currentStepIndex}-${currentStep.target!.selector}`;
    stepKeyRef.current = key;

    setPopupStyle({
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 10002,
      pointerEvents: "auto",
    });

    if (currentStep.target!.scrollIntoView !== false) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      // Recalculate spotlight after scrolling settles so coordinates are not stale.
      let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
      let rafId = 0;
      let lastScrollY = window.scrollY;

      const onScroll = () => {
        lastScrollY = window.scrollY;
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          rafId = requestAnimationFrame(updateSpotlight);
        }, 80);
      };

      window.addEventListener("scroll", onScroll, { passive: true });

      // Fallback: if no scroll events fire (element already in view) or scroll
      // finishes before the first event, ensure we still recalculate.
      scrollTimeout = setTimeout(() => {
        rafId = requestAnimationFrame(updateSpotlight);
      }, 150);

      return () => {
        window.removeEventListener("scroll", onScroll);
        if (scrollTimeout) clearTimeout(scrollTimeout);
        cancelAnimationFrame(rafId);
      };
    }
  }, [isOpen, currentStep, hasTarget, isNoTarget, currentStepIndex]);

  // Phase 2: After popup renders, measure actual dimensions and reposition.
  useLayoutEffect(() => {
    if (!isOpen || !currentStep || isNoTarget) return;

    const popupEl = popupRef.current;
    if (!popupEl) return;

    const actualRect = popupEl.getBoundingClientRect();
    if (actualRect.height === 0 || actualRect.width === 0) return;

    const el = document.querySelector(currentStep.target!.selector);
    if (!el) return;

    const targetRect = el.getBoundingClientRect();
    const preferredPosition = currentStep.target!.position ?? "bottom";
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const { top, left, transform } = computePopupPosition(
      targetRect,
      preferredPosition,
      actualRect.height,
      actualRect.width,
      vw,
      vh
    );

    const popupMaxWidth = Math.min(POPUP_MAX_WIDTH, vw - EDGE_MARGIN * 2);

    setPopupStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      transform,
      width: `${popupMaxWidth}px`,
      maxWidth: `${popupMaxWidth}px`,
      zIndex: 10002,
      pointerEvents: "auto",
    });
  }, [isOpen, currentStep, isNoTarget, currentStepIndex, spotlightRect]);

  // Recalculate on window resize.
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      setPopupStyle((prev) => ({ ...prev }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  // Focus the close button when step changes.
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen, currentStepIndex]);

  // Keyboard navigation — only Back/Next via arrow keys.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (isNavigationStep && !navigationReady) return;
        if (isInteractionStep) return;
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
    [isOpen, isFirstStep, isLastStep, isNavigationStep, isInteractionStep, navigationReady, nextStep, prevStep, completeTutorial]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !currentStep) return null;

  const prefersReducedMotion =
    preferences.reducedMotion === "on" ||
    (preferences.reducedMotion === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const overlayTransition = prefersReducedMotion
    ? {}
    : { transition: "opacity 0.2s ease" };

  const popupMaxWidth = getPopupMaxWidth();

  return (
    <>
      {/* Overlay — pointer-events:none lets sidebar/app clicks pass through */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          zIndex: 10000,
          pointerEvents: "none",
          ...(spotlightRect
            ? {
                clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${spotlightRect.left}px ${spotlightRect.top}px, ${spotlightRect.left}px ${spotlightRect.top + spotlightRect.height}px, ${spotlightRect.left + spotlightRect.width}px ${spotlightRect.top + spotlightRect.height}px, ${spotlightRect.left + spotlightRect.width}px ${spotlightRect.top}px, ${spotlightRect.left}px ${spotlightRect.top}px)`,
                WebkitClipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${spotlightRect.left}px ${spotlightRect.top}px, ${spotlightRect.left}px ${spotlightRect.top + spotlightRect.height}px, ${spotlightRect.left + spotlightRect.width}px ${spotlightRect.top + spotlightRect.height}px, ${spotlightRect.left + spotlightRect.width}px ${spotlightRect.top}px, ${spotlightRect.left}px ${spotlightRect.top}px)`,
              }
            : {}),
          ...overlayTransition,
        }}
      />

      {/* Spotlight cutout — removed; overlay clip-path handles the spotlight */}

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
          padding: `${POPUP_PADDING}px`,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          maxWidth: `${popupMaxWidth}px`,
          width: "100%",
          maxHeight: `calc(100vh - ${EDGE_MARGIN * 2}px)`,
          overflowY: "auto",
          boxSizing: "border-box",
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
            {t("tutorial.actions.closeTutorial")}
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            {!isFirstStep && !isAuthStep && (
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
            {isAuthStep ? (
              <button
                onClick={signInWithTutorial}
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
                {t("auth.signIn")}
              </button>
            ) : !isNavigationStep && !isInteractionStep ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

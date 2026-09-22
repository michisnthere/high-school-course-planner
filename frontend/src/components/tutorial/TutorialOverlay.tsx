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

const EDGE_MARGIN = 16;
const POPUP_MAX_WIDTH = 400;
const TARGET_GAP = 12;
const POPUP_PADDING = 24;

function computePopupPosition(
  targetRect: DOMRect,
  preferredPosition: "top" | "bottom" | "left" | "right",
  popupHeight: number
): { top: number; left: number; transform: string; position: string } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popupWidth = Math.min(POPUP_MAX_WIDTH, vw - EDGE_MARGIN * 2);

  // Available space in each direction from the target.
  const spaceAbove = targetRect.top - EDGE_MARGIN;
  const spaceBelow = vh - targetRect.bottom - EDGE_MARGIN;
  const spaceLeft = targetRect.left - EDGE_MARGIN;
  const spaceRight = vw - targetRect.right - EDGE_MARGIN;

  // Determine which positions can fit the popup.
  const canFitTop = spaceAbove >= popupHeight;
  const canFitBottom = spaceBelow >= popupHeight;
  const canFitLeft = spaceLeft >= popupWidth;
  const canFitRight = spaceRight >= popupWidth;

  // On small screens, prefer centered placement if no side fits well.
  const isSmallScreen = vw < 640;

  let position: "top" | "bottom" | "left" | "right" | "centered" = preferredPosition;

  // If the preferred position doesn't fit, try alternatives.
  if (position === "top" && !canFitTop) {
    position = canFitBottom ? "bottom" : canFitRight ? "right" : canFitLeft ? "left" : "centered";
  } else if (position === "bottom" && !canFitBottom) {
    position = canFitTop ? "top" : canFitRight ? "right" : canFitLeft ? "left" : "centered";
  } else if (position === "left" && !canFitLeft) {
    position = canFitRight ? "right" : canFitTop ? "top" : canFitBottom ? "bottom" : "centered";
  } else if (position === "right" && !canFitRight) {
    position = canFitLeft ? "left" : canFitTop ? "top" : canFitBottom ? "bottom" : "centered";
  }

  // On small screens, prefer centered placement over cramped side placement.
  if (isSmallScreen && position !== "top" && position !== "bottom") {
    if (!canFitLeft && !canFitRight) {
      position = "centered";
    }
  }

  if (position === "centered") {
    return {
      top: Math.max(EDGE_MARGIN, (vh - popupHeight) / 2),
      left: Math.max(EDGE_MARGIN, (vw - popupWidth) / 2),
      transform: "",
      position: "centered",
    };
  }

  let top: number;
  let left: number;
  let transform = "";

  switch (position) {
    case "top":
      top = targetRect.top - TARGET_GAP - popupHeight;
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
      left = targetRect.left - TARGET_GAP - popupWidth;
      transform = "translate(0, -50%)";
      break;
    case "right":
    default:
      top = targetRect.top + targetRect.height / 2;
      left = targetRect.right + TARGET_GAP;
      transform = "translate(0, -50%)";
      break;
  }

  // Clamp horizontally.
  if (left < EDGE_MARGIN) {
    if (transform.includes("translate(-50%")) {
      // Shift right to stay in view.
      left = EDGE_MARGIN;
      // Remove the -50% horizontal shift since we're anchored to left edge.
      transform = transform.replace("translate(-50%,", "translate(0,");
    } else {
      left = EDGE_MARGIN;
    }
  } else if (left + popupWidth > vw - EDGE_MARGIN) {
    if (transform.includes("translate(-50%")) {
      left = vw - EDGE_MARGIN - popupWidth;
    } else {
      left = vw - EDGE_MARGIN - popupWidth;
    }
  }

  // Clamp vertically.
  if (top < EDGE_MARGIN) {
    top = EDGE_MARGIN;
  } else if (top + popupHeight > vh - EDGE_MARGIN) {
    top = vh - EDGE_MARGIN - popupHeight;
  }

  // Final safety clamp.
  top = Math.max(EDGE_MARGIN, Math.min(top, vh - EDGE_MARGIN - popupHeight));
  left = Math.max(EDGE_MARGIN, Math.min(left, vw - EDGE_MARGIN - popupWidth));

  return { top, left, transform, position };
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
    navigationReady,
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

  const isLastStep = currentStepIndex === totalSteps - 1;
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

    // Measure popup height by temporarily making it visible off-screen.
    const popupEl = popupRef.current;
    let popupHeight = 200; // fallback
    if (popupEl) {
      popupEl.style.position = "fixed";
      popupEl.style.top = "-9999px";
      popupEl.style.left = "-9999px";
      popupEl.style.visibility = "hidden";
      popupEl.style.zIndex = "-1";
      popupHeight = popupEl.scrollHeight;
      popupEl.style.visibility = "";
      popupEl.style.zIndex = "";
    }

    const preferredPosition = currentStep.target.position ?? "bottom";
    const { top, left, transform } = computePopupPosition(rect, preferredPosition, popupHeight);

    const popupMaxWidth = Math.min(POPUP_MAX_WIDTH, window.innerWidth - EDGE_MARGIN * 2);

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

  // Recalculate on window resize.
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      // Force re-render to recalculate position.
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

  // Keyboard navigation.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        skipTutorial();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        // Don't allow keyboard advance on navigation steps (user must click the nav item).
        if (isNavigationStep && !navigationReady) return;
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
    [isOpen, isFirstStep, isLastStep, isNavigationStep, navigationReady, nextStep, prevStep, skipTutorial, completeTutorial]
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
          padding: `${POPUP_PADDING}px`,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          maxWidth: `${Math.min(POPUP_MAX_WIDTH, window.innerWidth - EDGE_MARGIN * 2)}px`,
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
            {isNavigationStep && !navigationReady ? (
              <button
                disabled
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  backgroundColor: "var(--brand-accent)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 20px",
                  cursor: "not-allowed",
                  opacity: 0.7,
                }}
              >
                {currentStep.navigationLabelKey
                  ? t(currentStep.navigationLabelKey)
                  : t("tutorial.actions.next")}
              </button>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </>
  );
}

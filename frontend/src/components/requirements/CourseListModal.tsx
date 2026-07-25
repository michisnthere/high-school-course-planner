"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import type { PlannerCourseDetails } from "@/lib/planner";

type CourseListModalProps = {
  requirementName: string;
  courses: PlannerCourseDetails[];
  onClose: () => void;
  getCourseDetailsHref: (course: PlannerCourseDetails) => string;
  onNavigate?: (course: PlannerCourseDetails) => void;
};

function scoreFor(course: PlannerCourseDetails, reqName: string): number {
  let score = 0;
  const fulfills = (course.fulfillsRequirements ?? []).map((r) => r.trim().toLowerCase());
  if (["english", "mathematics", "science", "social studies"].includes(reqName.toLowerCase()) &&
      fulfills.includes(reqName.toLowerCase())) score += 500;

  const ct = course.creditType;
  if (ct === "AP" || ct === "Honors") score -= 100;

  const title = course.title.toLowerCase();
  const numMatch = title.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    score -= num * 10;
  }

  if (course.prerequisites && course.prerequisites.length > 0) score -= 50;

  return score;
}

export function CourseListModal({
  requirementName,
  courses,
  onClose,
  getCourseDetailsHref,
  onNavigate,
}: CourseListModalProps): React.ReactElement {
  const { isMobile } = useBreakpoint();
  const [dragged, setDragged] = useState(0);
  const dragStart = useRef(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const pointerMoveRef = useRef<((ev: PointerEvent) => void) | null>(null);
  const pointerUpRef = useRef<((ev: PointerEvent) => void) | null>(null);

  const sorted = [...courses].sort((a, b) => {
    const sa = scoreFor(a, requirementName);
    const sb = scoreFor(b, requirementName);
    if (sa !== sb) return sb - sa;
    return a.title.localeCompare(b.title);
  });

  useEffect(() => {
    lastFocusRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => {
      if (isMobile && sheetRef.current) sheetRef.current.focus();
      else if (overlayRef.current) overlayRef.current.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isMobile]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && overlayRef.current) {
        const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (lastFocusRef.current && document.contains(lastFocusRef.current)) {
        lastFocusRef.current.focus();
      }
    };
  }, [onClose]);

  const cleanupPointerListeners = useCallback(() => {
    if (pointerMoveRef.current) {
      document.removeEventListener("pointermove", pointerMoveRef.current);
      pointerMoveRef.current = null;
    }
    if (pointerUpRef.current) {
      document.removeEventListener("pointerup", pointerUpRef.current);
      pointerUpRef.current = null;
    }
  }, []);

  useEffect(() => cleanupPointerListeners, [cleanupPointerListeners]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    pointerMoveRef.current = (ev: PointerEvent) => {
      const delta = ev.clientY - dragStart.current;
      if (delta > 0) setDragged(delta);
    };
    pointerUpRef.current = () => {
      if (dragged > 100) onClose();
      setDragged(0);
      cleanupPointerListeners();
    };
    document.addEventListener("pointermove", pointerMoveRef.current);
    document.addEventListener("pointerup", pointerUpRef.current);
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Courses that satisfy ${requirementName}`}
      tabIndex={-1}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: isMobile ? 0 : "32px",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .cml-animate { animation: none !important; }
        }
      `}</style>
      <div
        ref={sheetRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="cml-animate"
        style={{
          maxWidth: isMobile ? "100%" : "800px",
          width: "100%",
          maxHeight: isMobile ? "90vh" : "80vh",
          height: isMobile ? "90vh" : "auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: "#ffffff",
          borderRadius: isMobile ? "16px 16px 0 0" : "16px",
          padding: "0",
          position: "relative",
          animation: isMobile ? "slideUp 0.25s ease-out" : "scaleIn 0.2s ease-out",
          transform: isMobile && dragged > 0 ? `translateY(${dragged}px)` : undefined,
          transition: dragged > 0 ? "none" : undefined,
          boxSizing: "border-box",
          outline: "none",
        }}
      >
        {isMobile && (
          <div
            onPointerDown={onPointerDown}
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "10px 0 4px",
              cursor: "grab",
              touchAction: "none",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: "36px",
                height: "4px",
                backgroundColor: "#d1d5db",
                borderRadius: "2px",
              }}
            />
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "8px 20px 16px" : "24px 24px 16px",
            borderBottom: "1px solid #f3f4f6",
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? "18px" : "20px",
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.3,
            }}
          >
            Courses that satisfy {requirementName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: isMobile ? "44px" : "36px",
              height: isMobile ? "44px" : "36px",
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
              flexShrink: 0,
              marginLeft: "12px",
            }}
          >
            {"\u2715"}
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "12px 20px 24px" : "12px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {sorted.map((course) => {
            const href = getCourseDetailsHref(course);

            return (
              <Link
                key={course.id}
                href={href}
                onClick={(event) => {
                  if (!onNavigate) return;
                  event.preventDefault();
                  onNavigate(course);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 18px",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "10px",
                  textDecoration: "none",
                  color: "var(--text-primary)",
                  fontSize: "15px",
                  fontWeight: 500,
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  cursor: "pointer",
                  minHeight: "56px",
                  gap: "12px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--brand-accent)";
                  e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                  {course.title}
                </span>
                <span style={{ fontSize: "18px", color: "var(--text-muted)", flexShrink: 0, lineHeight: 1 }} aria-hidden="true">
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

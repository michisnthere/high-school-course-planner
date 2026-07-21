"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import type { PlannerCourseDetails } from "@/lib/planner";

type CourseListModalProps = {
  requirementName: string;
  courses: PlannerCourseDetails[];
  returnParams: string;
  onClose: () => void;
  onNavigate?: () => void;
};

function getCourseSlug(course: PlannerCourseDetails): string {
  return course.normalizedTitle || course.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const CORE_SUB_REQUIREMENTS: Record<string, string[]> = {
  Science: ["Biology", "Physical Science"],
  "Social Studies": ["U.S. History", "Government", "World History and Geography"],
};

function badgeFor(course: PlannerCourseDetails, reqName: string): { label: string; bg: string; text: string } {
  const fulfills = (course.fulfillsRequirements ?? []).map((r) => r.trim());
  const subReqs = CORE_SUB_REQUIREMENTS[reqName];
  if (subReqs) {
    for (const sub of subReqs) {
      if (fulfills.some((r) => r.toLowerCase() === sub.toLowerCase())) {
        return { label: "\u2713 Required", bg: "#dcfce7", text: "#166534" };
      }
    }
  }
  if (["English", "Mathematics", "Science", "Social Studies"].includes(reqName) &&
      fulfills.some((r) => r.toLowerCase() === reqName.toLowerCase())) {
    return { label: "\u2713 Required", bg: "#dcfce7", text: "#166534" };
  }
  const ct = course.creditType;
  if (ct === "AP") return { label: "AP", bg: "#f3e8ff", text: "#6b21a8" };
  if (ct === "Honors") return { label: "Honors", bg: "#f3e8ff", text: "#6b21a8" };
  if (course.prerequisites && course.prerequisites.length > 0) {
    const p = course.prerequisites[0];
    return { label: `Requires ${p.length > 28 ? p.substring(0, 26) + "..." : p}`, bg: "#fef3c7", text: "#92400e" };
  }
  return { label: "Recommended", bg: "#dbeafe", text: "#1e40af" };
}

function scoreFor(course: PlannerCourseDetails, reqName: string): number {
  let score = 0;
  const fulfills = (course.fulfillsRequirements ?? []).map((r) => r.trim().toLowerCase());
  const subReqs = (CORE_SUB_REQUIREMENTS[reqName] ?? []).map((r) => r.toLowerCase());
  if (subReqs.some((sr) => fulfills.includes(sr))) score += 1000;
  else if (["english", "mathematics", "science", "social studies"].includes(reqName.toLowerCase()) &&
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
  returnParams,
  onClose,
  onNavigate,
}: CourseListModalProps): React.ReactElement {
  const { isMobile } = useBreakpoint();
  const [dragged, setDragged] = useState(0);
  const dragStart = useRef(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

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

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    const handleMove = (ev: PointerEvent) => {
      const delta = ev.clientY - dragStart.current;
      if (delta > 0) setDragged(delta);
    };
    const handleUp = () => {
      if (dragged > 100) onClose();
      setDragged(0);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
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
          maxWidth: isMobile ? "100%" : "640px",
          width: "100%",
          maxHeight: isMobile ? "85vh" : "80vh",
          height: isMobile ? "85vh" : "auto",
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
        {/* Drag handle (mobile only) */}
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

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "8px 16px 12px" : "24px 24px 16px",
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

        {/* Course count */}
        <div
          style={{
            padding: isMobile ? "8px 16px" : "8px 24px",
            fontSize: "14px",
            color: "#6b7280",
            flexShrink: 0,
          }}
        >
          {courses.length} course{courses.length === 1 ? "" : "s"} found
        </div>

        {/* Scrollable list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "8px 16px 24px" : "8px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {sorted.map((course) => {
            const badge = badgeFor(course, requirementName);
            const slug = getCourseSlug(course);
            const href = `/catalog/${slug}?return=${encodeURIComponent(returnParams ? `/requirements?${returnParams}` : "/requirements")}&fromRequirement=${encodeURIComponent(requirementName)}`;
            const desc = course.description
              ? course.description.length > 100
                ? course.description.substring(0, 97) + "..."
                : course.description
              : null;

            return (
              <Link
                key={course.id}
                href={href}
                onClick={onNavigate}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  padding: "14px",
                  backgroundColor: "#FCF5DF",
                  border: "1px solid #ECBA2B",
                  borderRadius: "10px",
                  textDecoration: "none",
                  color: "#111827",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  cursor: "pointer",
                  minHeight: isMobile ? "56px" : "44px",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#d4a01e";
                  e.currentTarget.style.boxShadow = "0 1px 4px rgba(236,186,43,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#ECBA2B";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontWeight: 600, fontSize: "15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {course.title}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "3px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      backgroundColor: badge.bg,
                      color: badge.text,
                      borderRadius: "9999px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "140px",
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                {course.department && (
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>
                    {course.department}
                    {course.creditType && ` \u2022 ${course.creditType}`}
                  </span>
                )}
                {desc && (
                  <span style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.4 }}>
                    {desc}
                  </span>
                )}
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#ECBA2B", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                  More Details \u2192
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

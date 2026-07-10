"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSavedCourses } from "@/hooks/useSavedCourses";
import { CourseDetailPopover } from "@/components/catalog/CourseDetailPopover";
import { getDivisionColor, getDivisionBackgroundColor } from "@/lib/divisionColors";
import {
  getPlanners,
  addPlannedCourse,
  removePlannedCourse,
  movePlannedCourse,
  searchPlannerCourses,
  type Planner,
  type PlannerCourseDetails,
  type PlannedCourse,
  type CourseDuration,
} from "@/lib/planner";

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

const GRADUATION_CREDITS = 24;

export default function PlannerYearPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <PlannerYearContent />
    </ProtectedRoute>
  );
}

type RemovedCourseState = {
  plannerId: number;
  courseId: number;
  semester: number;
  slot: number;
  courseTitle: string;
  duration: CourseDuration;
};

type ToastType = "success" | "warning";

type ToastState = {
  message: string;
  type: ToastType;
  onUndo?: () => void;
  visible: boolean;
};

function PlannerYearContent(): React.ReactElement {
  const params = useParams();
  const year = Number(params.year);
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [allPlanners, setAllPlanners] = useState<Planner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<{
    semester: number;
    slot: number;
  } | null>(null);
  const [popoverCourse, setPopoverCourse] = useState<PlannerCourseDetails | null>(null);
  const [moveDialog, setMoveDialog] = useState<PlannedCourse | null>(null);
  const [removedCourse, setRemovedCourse] = useState<RemovedCourseState | null>(null);
  const [toast, setToast] = useState<ToastState>({ message: "", type: "success", visible: false });
  const [refreshKey, setRefreshKey] = useState(0);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ semester: number; slot: number } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { isSaved } = useSavedCourses();

  const loadPlanners = useCallback(async () => {
    try {
      const planners = await getPlanners();
      setAllPlanners(planners);
      const current = planners.find((p) => p.schoolYear === year);
      setPlanner(current || null);
    } catch {
      setPlanner(null);
      setAllPlanners([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (!year || !YEAR_LABELS[year]) {
      setError("Invalid school year.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    loadPlanners();
  }, [year, refreshKey, loadPlanners]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success", onUndo?: () => void) => {
    setToast({ message, type, onUndo, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  }, []);

  const handleOpenModal = useCallback((semester: number, slot: number) => {
    setActiveSlot({ semester, slot });
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveSlot(null);
  }, []);

  const handleCourseSelected = useCallback(
    async (courseId: number) => {
      if (!planner || !activeSlot) return;

      try {
        await addPlannedCourse(planner.id, courseId, activeSlot.semester, activeSlot.slot);
        setRefreshKey((k) => k + 1);
        handleCloseModal();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add course";
        showToast(message, "warning");
      }
    },
    [planner, activeSlot, handleCloseModal, showToast]
  );

  const handleRemoveCourse = useCallback(
    async (planned: PlannedCourse) => {
      try {
        await removePlannedCourse(planned.id);
        setRemovedCourse({
          plannerId: planned.plannerId,
          courseId: planned.courseId,
          semester: planned.semester,
          slot: planned.slot,
          courseTitle: planned.course.title,
          duration: planned.course.duration,
        });
        setRefreshKey((k) => k + 1);
        showToast(`Course removed.`, "success", () => {
          if (!removedCourse) return;
          handleUndoRemove({
            plannerId: planned.plannerId,
            courseId: planned.courseId,
            semester: planned.semester,
            slot: planned.slot,
            courseTitle: planned.course.title,
            duration: planned.course.duration,
          });
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove course";
        showToast(message, "warning");
      }
    },
    [showToast]
  );

  const handleUndoRemove = useCallback(async (state: RemovedCourseState) => {
    try {
      await addPlannedCourse(state.plannerId, state.courseId, state.semester, state.slot);
      setRemovedCourse(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to undo remove";
      showToast(message, "warning");
    }
  }, [showToast]);

  const handleMove = useCallback(
    async (plannedCourseId: number, semester: number, slot: number) => {
      try {
        await movePlannedCourse(plannedCourseId, semester, slot);
        setRefreshKey((k) => k + 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to move course";
        showToast(message, "warning");
      }
    },
    [showToast]
  );

  const handleDrop = useCallback(
    async (plannedCourseId: number, targetSemester: number, targetSlot: number) => {
      setDraggingId(null);
      setDragOverSlot(null);
      await handleMove(plannedCourseId, targetSemester, targetSlot);
    },
    [handleMove]
  );

  const plannedBySlot = (semester: number, slot: number) =>
    planner?.plannedCourses.find((course) => course.semester === semester && course.slot === slot);

  const renderSlot = (semester: number, slot: number) => {
    const planned = plannedBySlot(semester, slot);

    if (planned) {
      return (
        <PlannedCourseCard
          key={`${semester}-${slot}`}
          planned={planned}
          warnings={getWarnings(planned, allPlanners, semester, year)}
          isDragging={draggingId === planned.id}
          isDragOver={dragOverSlot?.semester === semester && dragOverSlot?.slot === slot}
          onRemove={() => handleRemoveCourse(planned)}
          onViewDetails={() => setPopoverCourse(planned.course)}
          onMove={() => setMoveDialog(planned)}
          onMenuToggle={() => setOpenMenuId((id) => (id === planned.id ? null : planned.id))}
          isMenuOpen={openMenuId === planned.id}
          onDragStart={() => setDraggingId(planned.id)}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={() => setDragOverSlot({ semester, slot })}
          onDragLeave={() => setDragOverSlot(null)}
          onDrop={(id) => handleDrop(id, semester, slot)}
        />
      );
    }

    return (
      <AddCourseCard
        key={`${semester}-${slot}`}
        semester={semester}
        slot={slot}
        onClick={() => handleOpenModal(semester, slot)}
        isDragOver={dragOverSlot?.semester === semester && dragOverSlot?.slot === slot}
        onDragOver={() => setDragOverSlot({ semester, slot })}
        onDragLeave={() => setDragOverSlot(null)}
        onDrop={(id) => handleDrop(id, semester, slot)}
      />
    );
  };

  return (
    <div
      style={{
        padding: "32px",
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
        minHeight: "calc(100vh - 64px)",
      }}
    >
      <Link
        href="/planner"
        style={{
          display: "inline-block",
          marginBottom: "16px",
          fontSize: "14px",
          color: "#d1d5db",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        ← Back to Planner
      </Link>

      <div
        style={{
          display: "flex",
          gap: "32px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 600px", minWidth: "300px" }}>
          <h1
            style={{
              margin: "0 0 28px",
              fontSize: "32px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.2,
            }}
          >
            {YEAR_LABELS[year] ?? "Year"} Planner
          </h1>

          {loading ? (
            <p style={{ color: "#d1d5db" }}>Loading planner...</p>
          ) : error ? (
            <p style={{ color: "#ef4444" }}>{error}</p>
          ) : !planner ? (
            <p style={{ color: "#d1d5db" }}>Planner not found.</p>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "32px",
                flexWrap: "wrap",
                alignItems: "stretch",
              }}
            >
              {[1, 2].map((semester) => (
                <section
                  key={semester}
                  style={{
                    flex: "1 1 0",
                    minWidth: "280px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <h2
                    style={{
                      margin: "0 0 16px",
                      fontSize: "22px",
                      fontWeight: 600,
                      color: "#ffffff",
                    }}
                  >
                    Semester {semester}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      flex: 1,
                    }}
                  >
                    {Array.from({ length: 7 }, (_, i) => renderSlot(semester, i + 1))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {!loading && planner && (
          <SummarySidebar planners={allPlanners} currentYear={year} />
        )}
      </div>

      {activeSlot && planner && (
        <CourseSearchModal
          onClose={handleCloseModal}
          onSelect={handleCourseSelected}
          isSaved={isSaved}
        />
      )}

      {popoverCourse && planner && (
        <CourseDetailPopover
          course={popoverCourse}
          returnUrl={`/planner/${year}`}
          onClose={() => setPopoverCourse(null)}
        />
      )}

      {moveDialog && planner && (
        <MoveDialog
          planned={moveDialog}
          onClose={() => setMoveDialog(null)}
          onMove={handleMove}
          occupiedSlots={planner.plannedCourses.map((p) => ({
            semester: p.semester,
            slot: p.slot,
            courseId: p.courseId,
            title: p.course.title,
          }))}
        />
      )}

      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onUndo={toast.onUndo}
          onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
        />
      )}
    </div>
  );
}

function SummarySidebar({
  planners,
  currentYear,
}: {
  planners: Planner[];
  currentYear: number;
}): React.ReactElement {
  const currentPlanner = planners.find((p) => p.schoolYear === currentYear);
  const allCourses = planners.flatMap((p) => p.plannedCourses);

  const totalCredits = allCourses.reduce((sum, pc) => sum + (pc.course.credits || 0), 0);
  const currentCredits = (currentPlanner?.plannedCourses || []).reduce(
    (sum, pc) => sum + (pc.course.credits || 0),
    0
  );
  const currentCourseCount = currentPlanner?.plannedCourses.length || 0;
  const fullYearCount = currentPlanner?.plannedCourses.filter((pc) => pc.course.duration === "Full Year").length || 0;
  const semesterCount = currentCourseCount - fullYearCount;
  const creditsRemaining = Math.max(0, GRADUATION_CREDITS - totalCredits);

  return (
    <aside
      style={{
        flex: "0 0 320px",
        minWidth: "280px",
        maxWidth: "100%",
        padding: "24px",
        backgroundColor: "#1f2937",
        border: "1px solid #374151",
        borderRadius: "16px",
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
      }}
    >
      <h2
        style={{
          margin: "0 0 20px",
          fontSize: "18px",
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        Planner Summary
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <SummaryRow label="Total Credits" value={currentCredits.toFixed(1)} />
        <SummaryRow label="Planned Courses" value={String(currentCourseCount)} />
        <SummaryRow label="Full-Year Courses" value={String(fullYearCount)} />
        <SummaryRow label="Semester Courses" value={String(semesterCount)} />
        <SummaryRow label="Overall Credits" value={totalCredits.toFixed(1)} />
        <SummaryRow label="Credits Remaining" value={creditsRemaining.toFixed(1)} />
      </div>

      <div
        style={{
          marginTop: "24px",
          paddingTop: "20px",
          borderTop: "1px solid #374151",
        }}
      >
        <div
          style={{
            height: "8px",
            backgroundColor: "#374151",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, (totalCredits / GRADUATION_CREDITS) * 100)}%`,
              height: "100%",
              backgroundColor: "#22c55e",
              borderRadius: "9999px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "13px",
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          {totalCredits.toFixed(1)} / {GRADUATION_CREDITS} credits
        </p>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "15px",
      }}
    >
      <span style={{ color: "#9ca3af" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#ffffff" }}>{value}</span>
    </div>
  );
}

function AddCourseCard({
  semester,
  slot,
  onClick,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  semester: number;
  slot: number;
  onClick: () => void;
  isDragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (plannedCourseId: number) => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        onDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = Number(e.dataTransfer.getData("plannedCourseId"));
        if (id) onDrop(id);
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "20px",
        minHeight: "120px",
        backgroundColor: isDragOver ? "rgba(37, 99, 235, 0.15)" : "#1f2937",
        border: `2px dashed ${isDragOver ? "#3b82f6" : "#4b5563"}`,
        borderRadius: "12px",
        cursor: "pointer",
        color: isDragOver ? "#93c5fd" : "#9ca3af",
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
        transition: "all 0.2s ease",
        textAlign: "center",
      }}
      onMouseEnter={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.borderColor = "#6b7280";
          e.currentTarget.style.color = "#d1d5db";
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.borderColor = "#4b5563";
          e.currentTarget.style.color = "#9ca3af";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        Slot {slot}
      </div>
      <div
        style={{
          fontSize: "16px",
          fontWeight: 500,
        }}
      >
        + Add Course
      </div>
    </button>
  );
}

function PlannedCourseCard({
  planned,
  warnings,
  isDragging,
  isDragOver,
  onRemove,
  onViewDetails,
  onMove,
  onMenuToggle,
  isMenuOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  planned: PlannedCourse;
  warnings: string[];
  isDragging: boolean;
  isDragOver: boolean;
  onRemove: () => void;
  onViewDetails: () => void;
  onMove: () => void;
  onMenuToggle: () => void;
  isMenuOpen: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (plannedCourseId: number) => void;
}): React.ReactElement {
  const { course } = planned;
  const accentColor = getDivisionColor(course.division);
  const bgTint = getDivisionBackgroundColor(course.division);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("plannedCourseId", String(planned.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        onDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(e.dataTransfer.getData("plannedCourseId"));
        if (id && id !== planned.id) onDrop(id);
      }}
      style={{
        padding: "16px",
        backgroundColor: isDragOver ? "rgba(37, 99, 235, 0.15)" : bgTint,
        border: `1px solid ${isDragOver ? "#3b82f6" : accentColor}`,
        borderLeftWidth: "4px",
        borderRadius: "12px",
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minHeight: "120px",
        cursor: "move",
        opacity: isDragging ? 0.5 : 1,
        transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
        transform: isDragOver ? "scale(1.02)" : "scale(1)",
        boxShadow: isDragOver ? "0 0 0 2px rgba(59, 130, 246, 0.3)" : "none",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "8px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          Slot {planned.slot}
        </div>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Course actions"
            aria-expanded={isMenuOpen}
            style={{
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "transparent",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              color: "#9ca3af",
              fontSize: "18px",
              lineHeight: 1,
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "#d1d5db";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#9ca3af";
            }}
          >
            ⋯
          </button>
          {isMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                minWidth: "160px",
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
                zIndex: 20,
                overflow: "hidden",
              }}
            >
              <MenuItem label="View Course Details" onClick={onViewDetails} />
              <MenuItem label="Move Course" onClick={onMove} />
              <MenuItem
                label="Remove Course"
                onClick={() => {
                  onMenuToggle();
                  onRemove();
                }}
                danger
              />
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#ffffff",
          lineHeight: 1.3,
        }}
      >
        {course.title}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          fontSize: "13px",
          color: "#9ca3af",
        }}
      >
        {course.creditType && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "rgba(0,0,0,0.2)",
              borderRadius: "9999px",
              fontWeight: 500,
            }}
          >
            {course.creditType}
          </span>
        )}
        {course.credits != null && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "rgba(0,0,0,0.2)",
              borderRadius: "9999px",
              fontWeight: 500,
            }}
          >
            {course.credits} credits
          </span>
        )}
        {course.duration === "Full Year" && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "rgba(0,0,0,0.2)",
              borderRadius: "9999px",
              fontWeight: 500,
            }}
          >
            Full Year
          </span>
        )}
      </div>

      {warnings.length > 0 && (
        <div
          style={{
            marginTop: "4px",
            padding: "8px 10px",
            backgroundColor: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#fde047",
            lineHeight: 1.4,
          }}
        >
          {warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 14px",
        fontSize: "14px",
        fontWeight: 500,
        color: danger ? "#fca5a5" : "#d1d5db",
        backgroundColor: "transparent",
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
        transition: "background-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {label}
    </button>
  );
}

function MoveDialog({
  planned,
  onClose,
  onMove,
  occupiedSlots,
}: {
  planned: PlannedCourse;
  onClose: () => void;
  onMove: (plannedCourseId: number, semester: number, slot: number) => Promise<void>;
  occupiedSlots: Array<{ semester: number; slot: number; courseId: number; title: string }>;
}): React.ReactElement {
  const [targetSemester, setTargetSemester] = useState(planned.semester);
  const [targetSlot, setTargetSlot] = useState(planned.slot);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onMove(planned.id, targetSemester, targetSlot);
    setSubmitting(false);
    onClose();
  };

  const occupied = occupiedSlots.find(
    (s) => s.semester === targetSemester && s.slot === targetSlot && s.courseId !== planned.courseId
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "16px",
          padding: "24px",
          fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "20px",
            fontWeight: 600,
            color: "#ffffff",
          }}
        >
          Move Course
        </h2>

        <p style={{ margin: "0 0 16px", fontSize: "15px", color: "#d1d5db" }}>
          Choose a new semester and slot for <strong>{planned.course.title}</strong>.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          <label style={{ fontSize: "14px", color: "#9ca3af" }}>
            Semester
            <select
              value={targetSemester}
              onChange={(e) => setTargetSemester(Number(e.target.value))}
              style={{
                width: "100%",
                marginTop: "6px",
                padding: "10px 12px",
                fontSize: "15px",
                color: "#ffffff",
                backgroundColor: "#111827",
                border: "1px solid #4b5563",
                borderRadius: "8px",
              }}
            >
              <option value={1}>Semester 1</option>
              <option value={2}>Semester 2</option>
            </select>
          </label>

          <label style={{ fontSize: "14px", color: "#9ca3af" }}>
            Slot
            <select
              value={targetSlot}
              onChange={(e) => setTargetSlot(Number(e.target.value))}
              style={{
                width: "100%",
                marginTop: "6px",
                padding: "10px 12px",
                fontSize: "15px",
                color: "#ffffff",
                backgroundColor: "#111827",
                border: "1px solid #4b5563",
                borderRadius: "8px",
              }}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Slot {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>

        {occupied && (
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "14px",
              color: "#fca5a5",
            }}
          >
            {occupied.title} is already in this slot. They will swap places.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#d1d5db",
              backgroundColor: "transparent",
              border: "1px solid #4b5563",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#2563eb",
              border: "none",
              borderRadius: "8px",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Moving..." : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseSearchModal({
  onClose,
  onSelect,
  isSaved,
}: {
  onClose: () => void;
  onSelect: (courseId: number) => void;
  isSaved: (courseId: number) => boolean;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const [allCourses, setAllCourses] = useState<PlannerCourseDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    searchPlannerCourses("")
      .then(setAllCourses)
      .catch(() => setAllCourses([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredResults = allCourses.filter((course) =>
    course.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  const sortedResults = [...filteredResults].sort((a, b) => {
    const aSaved = isSaved(a.id) ? 1 : 0;
    const bSaved = isSaved(b.id) ? 1 : 0;
    return bSaved - aSaved;
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "80vh",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "24px 24px 16px",
            borderBottom: "1px solid #374151",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              Add a Course
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: "24px",
                color: "#9ca3af",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <input
            type="text"
            placeholder="Search by course title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: "16px",
              color: "#ffffff",
              backgroundColor: "#111827",
              border: "1px solid #4b5563",
              borderRadius: "10px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 24px 24px",
          }}
        >
          {loading ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>Loading courses...</p>
          ) : sortedResults.length === 0 ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>
              {query.trim() === "" ? "No courses available." : "No courses match your search."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {sortedResults.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onSelect(course.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "16px",
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "inherit",
                    width: "100%",
                    transition: "border-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#4b5563";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#374151";
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          color: "#ffffff",
                        }}
                      >
                        {course.title}
                      </span>
                      {isSaved(course.id) && (
                        <span
                          style={{
                            fontSize: "18px",
                            color: "#fbbf24",
                          }}
                          aria-label="Saved"
                        >
                          ★
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        fontSize: "13px",
                        color: "#9ca3af",
                      }}
                    >
                      {course.creditType && (
                        <span
                          style={{
                            padding: "3px 8px",
                            backgroundColor: "#1f2937",
                            borderRadius: "9999px",
                          }}
                        >
                          {course.creditType}
                        </span>
                      )}
                      {course.credits != null && (
                        <span
                          style={{
                            padding: "3px 8px",
                            backgroundColor: "#1f2937",
                            borderRadius: "9999px",
                          }}
                        >
                          {course.credits} credits
                        </span>
                      )}
                      {course.duration && (
                        <span
                          style={{
                            padding: "3px 8px",
                            backgroundColor: "#1f2937",
                            borderRadius: "9999px",
                          }}
                        >
                          {course.duration}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#3b82f6",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Add →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Toast({
  message,
  type,
  onUndo,
  onClose,
}: {
  message: string;
  type: ToastType;
  onUndo?: () => void;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 20px",
        backgroundColor: type === "warning" ? "#7c2d12" : "#1f2937",
        border: `1px solid ${type === "warning" ? "#9a3412" : "#374151"}`,
        borderRadius: "12px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
        zIndex: 200,
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
      }}
    >
      <span style={{ fontSize: "14px", color: "#ffffff" }}>{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={() => {
            onUndo();
            onClose();
          }}
          style={{
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#ffffff",
            backgroundColor: "#2563eb",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Undo
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        style={{
          fontSize: "18px",
          color: "#9ca3af",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}

function getWarnings(
  planned: PlannedCourse,
  allPlanners: Planner[],
  currentSemester: number,
  currentYear: number
): string[] {
  const warnings: string[] = [];
  const { course } = planned;

  if (!course.prerequisites || course.prerequisites.length === 0) {
    return warnings;
  }

  // Build ordered list of all planned courses across all years/semesters.
  const ordered: Array<{ year: number; semester: number; title: string }> = [];
  for (const p of allPlanners) {
    for (const pc of p.plannedCourses) {
      ordered.push({
        year: p.schoolYear,
        semester: pc.semester,
        title: pc.course.title,
      });
    }
  }
  ordered.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.semester - b.semester;
  });

  const plannedIndex = ordered.findIndex(
    (item) =>
      item.year === currentYear &&
      item.semester === currentSemester &&
      item.title === course.title
  );

  for (const prereq of course.prerequisites) {
    if (!prereq.trim()) continue;
    const normalizedPrereq = prereq.toLowerCase();

    const prereqIndex = ordered.findIndex((item) =>
      item.title.toLowerCase().includes(normalizedPrereq)
    );

    if (prereqIndex === -1) {
      warnings.push(`${course.title} usually requires ${prereq} first.`);
    } else if (plannedIndex !== -1 && prereqIndex > plannedIndex) {
      warnings.push(`A prerequisite for this course appears later in your plan.`);
    }
  }

  return warnings;
}

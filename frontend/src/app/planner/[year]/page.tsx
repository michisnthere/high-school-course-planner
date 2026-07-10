"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSavedCourses } from "@/hooks/useSavedCourses";
import { getCourseSlug } from "@/lib/normalize";
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

type HistoryEntry = {
  planners: Planner[];
  undo: () => Promise<void>;
};

function applyIdMap(planners: Planner[], idMap: Map<number, number>): Planner[] {
  return planners.map((p) => ({
    ...p,
    plannedCourses: p.plannedCourses.map((pc) => {
      const mappedId = idMap.get(pc.id);
      return mappedId !== undefined ? { ...pc, id: mappedId } : pc;
    }),
  }));
}

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
  const [toast, setToast] = useState<ToastState>({ message: "", type: "success", visible: false });
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ semester: number; slot: number } | null>(null);
  const scrollYRef = useRef<number | null>(null);
  const loadedYearRef = useRef<number | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const { isSaved } = useSavedCourses();
  const router = useRouter();

  const loadPlanners = useCallback(async () => {
    try {
      const planners = await getPlanners();
      setAllPlanners(planners);
      const current = planners.find((p) => p.schoolYear === year);
      setPlanner(current || null);
      historyRef.current = [{ planners, undo: async () => {} }];
      setCanUndo(false);
    } catch {
      setPlanner(null);
      setAllPlanners([]);
      historyRef.current = [];
      setCanUndo(false);
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

    const isYearChange = loadedYearRef.current !== year;
    loadedYearRef.current = year;
    if (isYearChange) {
      setLoading(true);
    }
    setError(null);
    loadPlanners();
  }, [year, loadPlanners]);

  useLayoutEffect(() => {
    if (scrollYRef.current !== null) {
      window.scrollTo(0, scrollYRef.current);
      scrollYRef.current = null;
    }
  }, [planner, allPlanners]);

  const showToast = useCallback((message: string, type: ToastType = "success", onUndo?: () => void) => {
    setToast({ message, type, onUndo, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  }, []);

  const pushHistory = useCallback(
    (newPlanners: Planner[], undo: () => Promise<void>) => {
      historyRef.current = [...historyRef.current, { planners: newPlanners, undo }];
      setAllPlanners(newPlanners);
      setPlanner(newPlanners.find((p) => p.schoolYear === year) || null);
      setCanUndo(true);
    },
    [year]
  );

  const handleUndo = useCallback(async () => {
    if (historyRef.current.length <= 1) return;
    scrollYRef.current = window.scrollY;
    const entry = historyRef.current[historyRef.current.length - 1];
    try {
      await entry.undo();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to undo";
      showToast(message, "warning");
      return;
    }
    const previous = historyRef.current[historyRef.current.length - 1];
    setAllPlanners(previous.planners);
    setPlanner(previous.planners.find((p) => p.schoolYear === year) || null);
    setCanUndo(historyRef.current.length > 1);
  }, [year, showToast]);

  const handleOpenModal = useCallback((semester: number, slot: number) => {
    setActiveSlot({ semester, slot });
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveSlot(null);
  }, []);

  const handleCourseClick = useCallback((planned: PlannedCourse) => {
    const slug = getCourseSlug({
      title: planned.course.title,
      normalizedTitle: planned.course.normalizedTitle,
    });
    router.push(`/catalog/${slug}?return=${encodeURIComponent(`/planner/${year}`)}`);
  }, [router, year]);

  const handleCourseSelected = useCallback(
    async (courseId: number) => {
      if (!planner || !activeSlot) return;

      try {
        scrollYRef.current = window.scrollY;
        const added = await addPlannedCourse(planner.id, courseId, activeSlot.semester, activeSlot.slot);
        const newPlanners = allPlanners.map((p) =>
          p.id === planner.id ? { ...p, plannedCourses: [...p.plannedCourses, ...added] } : p
        );
        pushHistory(newPlanners, async () => {
          if (added.length > 0) {
            await removePlannedCourse(added[0].id);
          }
          historyRef.current = historyRef.current.slice(0, -1);
        });
        handleCloseModal();
        showToast("Course added.", "success", handleUndo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add course";
        showToast(message, "warning");
      }
    },
    [planner, activeSlot, allPlanners, handleCloseModal, pushHistory, showToast, handleUndo]
  );

  const handleRemoveCourse = useCallback(
    async (planned: PlannedCourse) => {
      try {
        scrollYRef.current = window.scrollY;
        const removedEntries = allPlanners
          .find((p) => p.id === planned.plannerId)
          ?.plannedCourses.filter((pc) =>
            planned.course.duration === 2
              ? pc.courseId === planned.courseId && pc.slot === planned.slot
              : pc.id === planned.id
          ) ?? [];

        const newPlanners = allPlanners.map((p) =>
          p.id === planned.plannerId
            ? {
                ...p,
                plannedCourses: p.plannedCourses.filter((pc) => !removedEntries.some((r) => r.id === pc.id)),
              }
            : p
        );

        await removePlannedCourse(planned.id);
        pushHistory(newPlanners, async () => {
          const restored = await addPlannedCourse(
            planned.plannerId,
            planned.courseId,
            planned.semester,
            planned.slot
          );
          const previousIndex = historyRef.current.length - 2;
          const previousEntry = historyRef.current[previousIndex];
          const updatedPlanners = previousEntry.planners.map((p) => {
            if (p.id !== planned.plannerId) return p;
            return {
              ...p,
              plannedCourses: [
                ...p.plannedCourses.filter((pc) => !removedEntries.some((r) => r.id === pc.id)),
                ...restored,
              ],
            };
          });
          historyRef.current = [
            ...historyRef.current.slice(0, previousIndex),
            { ...previousEntry, planners: updatedPlanners },
          ];
        });
        showToast("Course removed.", "success", handleUndo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove course";
        showToast(message, "warning");
      }
    },
    [allPlanners, pushHistory, showToast, handleUndo]
  );

  const handleMove = useCallback(
    async (plannedCourseId: number, semester: number, slot: number) => {
      try {
        scrollYRef.current = window.scrollY;
        const source = allPlanners.flatMap((p) => p.plannedCourses).find((pc) => pc.id === plannedCourseId);
        if (!source) return;

        const updatedPlanner = await movePlannedCourse(plannedCourseId, semester, slot);
        const newPlanners = allPlanners.map((p) =>
          p.schoolYear === updatedPlanner.schoolYear ? updatedPlanner : p
        );
        pushHistory(newPlanners, async () => {
          await movePlannedCourse(plannedCourseId, source.semester, source.slot);
          historyRef.current = historyRef.current.slice(0, -1);
        });
        showToast("Course moved.", "success", handleUndo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to move course";
        showToast(message, "warning");
      }
    },
    [allPlanners, pushHistory, showToast, handleUndo]
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
          onClick={() => handleCourseClick(planned)}
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
  const fullYearCount = currentPlanner?.plannedCourses.filter((pc) => pc.course.duration === 2).length || 0;
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
  onClick,
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
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (plannedCourseId: number) => void;
}): React.ReactElement {
  const { course } = planned;
  const accentColor = getDivisionColor(course.division);
  const bgTint = getDivisionBackgroundColor(course.division);
  const dragStarted = useRef(false);

  return (
    <div
      draggable
      onClick={() => {
        if (dragStarted.current) {
          dragStarted.current = false;
          return;
        }
        onClick();
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData("plannedCourseId", String(planned.id));
        dragStarted.current = true;
        onDragStart();
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          dragStarted.current = false;
        }, 0);
        onDragEnd();
      }}
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          draggable={false}
          aria-label="Remove course"
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
            fontSize: "16px",
            lineHeight: 1,
            transition: "background-color 0.15s ease, color 0.15s ease",
            flex: "0 0 auto",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#9ca3af";
          }}
        >
          🗑
        </button>
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
        {course.duration === 2 && (
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
                      {course.duration === 2 && (
                        <span
                          style={{
                            padding: "3px 8px",
                            backgroundColor: "#1f2937",
                            borderRadius: "9999px",
                          }}
                        >
                          Full Year
                        </span>
                      )}
                      {course.duration === 1 && (
                        <span
                          style={{
                            padding: "3px 8px",
                            backgroundColor: "#1f2937",
                            borderRadius: "9999px",
                          }}
                        >
                          One Semester
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

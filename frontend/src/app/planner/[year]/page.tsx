"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSavedCourses } from "@/hooks/useSavedCourses";
import { useServices } from "@/services/ServiceContext";
import { getCourseSlug } from "@/lib/normalize";
import { getDivisionColor, getDivisionBackgroundColor } from "@/lib/divisionColors";
import {
  courseToPlannerDetails,
  plannerOptionToPlannerDetails,
  type Planner,
  type PlannerCourseDetails,
  type PlannedCourse,
  type PlannerOption,
} from "@/lib/planner";
import { getCourses } from "@/lib/api";
import { sumPlannedCredits } from "@/lib/courseCredits";
import type { PeSemesterStatus } from "@/lib/gradeRequirements";
import { GradeRequirements } from "@/components/planner/GradeRequirements";
import {
  courseMatchesQuery,
  courseMatchesDivisionFilter,
  extractDivisionsFromItems,
  formatCreditType,
  formatPrerequisiteForDisplay,
} from "@/lib/catalog";
import {
  type CompletedCourse,
  type GradeCompleted,
} from "@/lib/completedCourses";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";
import type { StudentPlanningData } from "@/lib/studentData";
import { CompletedCoursePicker } from "@/components/planner/CompletedCoursePicker";
import { normalizePrerequisite, prerequisiteMatches } from "@/lib/prerequisiteNormalization";
import { computeCourseLoadRequirements } from "@/lib/courseLoadRequirements";
import { CourseLoadRequirements } from "@/components/planner/CourseLoadRequirements";
import { WaiverSection } from "@/components/planner/WaiverSection";
import type { RequirementResolution } from "@/lib/api";
import { getResolutions, createResolution, deleteResolution } from "@/lib/api";
import type { PeWaiver } from "@/lib/plannerWaivers";

const PLANNER_OPTION_COLORS = {
  border: "#6b7280",
  background: "#374151",
};

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

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

function clonePlanners(planners: Planner[]): Planner[] {
  return planners.map((p) => ({ ...p, plannedCourses: p.plannedCourses.map((pc) => ({ ...pc })) }));
}

function replacePlannerInList(planners: Planner[], updated: Planner): Planner[] {
  return planners.map((p) => (p.id === updated.id ? updated : p));
}

function buildAddCourseUndo(
  beforePlanners: Planner[],
  afterPlanner: Planner,
  removeFn: (id: number) => Promise<void>,
  moveFn: (id: number, semester: number, slot: number) => Promise<Planner>
): () => Promise<void> {
  const beforeMap = new Map(
    beforePlanners
      .flatMap((p) => p.plannedCourses)
      .map((pc) => [pc.id, { semester: pc.semester, slot: pc.slot }])
  );

  const addedCourses = afterPlanner.plannedCourses.filter((pc) => !beforeMap.has(pc.id));
  const shiftedCourses = afterPlanner.plannedCourses
    .filter((pc) => beforeMap.has(pc.id))
    .map((pc) => {
      const before = beforeMap.get(pc.id)!;
      return {
        id: pc.id,
        newSemester: pc.semester,
        newSlot: pc.slot,
        originalSemester: before.semester,
        originalSlot: before.slot,
      };
    })
    .filter((shift) => shift.newSemester !== shift.originalSemester || shift.newSlot !== shift.originalSlot)
    .sort((a, b) => a.newSlot - b.newSlot);

  return async () => {
    if (addedCourses.length > 0) {
      await removeFn(addedCourses[0].id);
    }
    for (const shift of shiftedCourses) {
      await moveFn(shift.id, shift.originalSemester, shift.originalSlot);
    }
  };
}

function applyOptimisticMove(
  planners: Planner[],
  source: PlannedCourse,
  targetSemester: number,
  targetSlot: number
): Planner[] {
  const plannerIndex = planners.findIndex((p) => p.id === source.plannerId);
  if (plannerIndex === -1) return planners;

  const planner = planners[plannerIndex];
  const courses = planner.plannedCourses;

  const replacePlanner = (newCourses: PlannedCourse[]): Planner[] => [
    ...planners.slice(0, plannerIndex),
    { ...planner, plannedCourses: newCourses },
    ...planners.slice(plannerIndex + 1),
  ];

  // Multi-slot courses cannot be moved via drag-and-drop.
  if ((source.slotSpan ?? 1) > 1) return planners;

  if (source.course.duration === 2) {
    // Full-year: dropping on the same slot is a no-op; semester is ignored by the API.
    if (source.slot === targetSlot) return planners;

    const targetOccupants = courses.filter((pc) => pc.slot === targetSlot);
    if (targetOccupants.length === 0) {
      return replacePlanner(
        courses.map((pc) =>
          pc.courseId === source.courseId && pc.slot === source.slot ? { ...pc, slot: targetSlot } : pc
        )
      );
    }

    const allSameCourse = targetOccupants.every((pc) => pc.courseId === targetOccupants[0].courseId);
    const allFullYear = targetOccupants.every((pc) => pc.course.duration === 2);
    if (allSameCourse && allFullYear) {
      const targetCourseId = targetOccupants[0].courseId;
      if (targetCourseId === source.courseId) return planners;
      return replacePlanner(
        courses.map((pc) => {
          if (pc.courseId === source.courseId && pc.slot === source.slot) {
            return { ...pc, slot: targetSlot };
          }
          if (pc.courseId === targetCourseId && pc.slot === targetSlot) {
            return { ...pc, slot: source.slot };
          }
          return pc;
        })
      );
    }

    // Full-year cannot be dropped onto a slot occupied by a one-semester course.
    return planners;
  }

  // One-semester source.
  if (source.semester === targetSemester && source.slot === targetSlot) return planners;

  const target = courses.find((pc) => pc.semester === targetSemester && pc.slot === targetSlot);
  if (!target) {
    return replacePlanner(
      courses.map((pc) =>
        pc.id === source.id ? { ...pc, semester: targetSemester, slot: targetSlot } : pc
      )
    );
  }

  if (target.course.duration === 2) {
    // One-semester courses cannot swap with full-year courses.
    return planners;
  }

  return replacePlanner(
    courses.map((pc) => {
      if (pc.id === source.id) {
        return { ...pc, semester: targetSemester, slot: targetSlot };
      }
      if (pc.id === target.id) {
        return { ...pc, semester: source.semester, slot: source.slot };
      }
      return pc;
    })
  );
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
  const undoRestoredPlannerRef = useRef<Planner | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const [selectedWarning, setSelectedWarning] = useState<{
    planned: PlannedCourse;
    warning: PlannerWarning;
  } | null>(null);
  const [ignoredWarnings, setIgnoredWarnings] = useState<Set<string>>(new Set());
  const [highlightedPlannedCourseId, setHighlightedPlannedCourseId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ignoredPlannerWarnings");
      if (stored) {
        setIgnoredWarnings(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore localStorage failures
    }
  }, []);

  const persistIgnoredWarning = useCallback((key: string) => {
    setIgnoredWarnings((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem("ignoredPlannerWarnings", JSON.stringify(Array.from(next)));
      } catch {
        // ignore localStorage failures
      }
      return next;
    });
  }, []);

  const { isSaved } = useSavedCourses();
  const { planner: plannerService, completedCourses: completedService, analysis: analysisService } = useServices();
  const router = useRouter();

  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [completedCoursePicker, setCompletedCoursePicker] = useState<{ open: boolean; excludeCourseIds?: number[] }>({ open: false });
  const [plannerAnalysis, setPlannerAnalysis] = useState<PlannerAnalysis | null>(null);
  const [allCatalogCourses, setAllCatalogCourses] = useState<PlannerCourseDetails[]>([]);
  const [resolutions, setResolutions] = useState<RequirementResolution[]>([]);

  const loadCompletedCourses = useCallback(async () => {
    try {
      const courses = await completedService.getCompletedCourses();
      setCompletedCourses(courses);
    } catch {
      setCompletedCourses([]);
    }
  }, [completedService]);

  const loadAllCatalogCourses = useCallback(async () => {
    try {
      const courses = await getCourses();
      const details = courses.map(courseToPlannerDetails);
      setAllCatalogCourses(details);
      plannerService.seedCourseCatalog(details);
    } catch {
      setAllCatalogCourses([]);
    }
  }, [plannerService]);

  const loadResolutions = useCallback(async () => {
    try {
      const data = await getResolutions();
      setResolutions(data);
    } catch {
      setResolutions([]);
    }
  }, []);

  useEffect(() => {
    loadCompletedCourses();
    loadAllCatalogCourses();
    loadResolutions();
  }, [loadCompletedCourses, loadAllCatalogCourses, loadResolutions]);

  useEffect(() => {
    const data: StudentPlanningData = {
      planners: allPlanners,
      completedCourses,
      resolutions,
      allCourses: allCatalogCourses,
    };
    analysisService.getAnalysis(data)
      .then(setPlannerAnalysis)
      .catch(() => setPlannerAnalysis(null));
  }, [allPlanners, completedCourses, resolutions, allCatalogCourses, analysisService]);

  const loadPlanners = useCallback(async () => {
    try {
      const planners = await plannerService.getPlanners();
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
  }, [year, plannerService]);

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
    // Pop the undone entry and restore the previous planner state.
    historyRef.current = historyRef.current.slice(0, -1);
    const previous = historyRef.current[historyRef.current.length - 1];

    // If the undo restored a planner entry (e.g. undoing a delete), the
    // previously-deleted database row was recreated with a new auto-increment
    // id.  Use the freshly-restored planner data so the UI references the new
    // id, not the stale id from the history snapshot.
    const restored = undoRestoredPlannerRef.current;
    undoRestoredPlannerRef.current = null;
    const planners = restored
      ? previous.planners.map((p) => (p.id === restored.id ? restored : p))
      : previous.planners;

    setAllPlanners(planners);
    setPlanner(planners.find((p) => p.schoolYear === year) || null);
    setCanUndo(historyRef.current.length > 1);
  }, [year, showToast]);

  const handleOpenModal = useCallback((semester: number, slot: number) => {
    setActiveSlot({ semester, slot });
  }, []);

  const handleCompletedCourseSubmit = useCallback(
    async ({
      courseId,
      gradeCompleted,
      letterGrade,
    }: {
      courseId: number;
      gradeCompleted: GradeCompleted;
      letterGrade: string | null;
    }) => {
      try {
        await completedService.addCompletedCourse(courseId, gradeCompleted, letterGrade);
        setCompletedCoursePicker({ open: false });
        await loadCompletedCourses();
        showToast("Course marked as completed.", "success");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to mark course as completed";
        showToast(message, "warning");
      }
    },
    [loadCompletedCourses, showToast, completedService]
  );

  const handleAddResolution = useCallback(
    async (data: { type: string; courseId?: number; metadata?: Record<string, unknown> }) => {
      try {
        await createResolution(data);
        const updated = await getResolutions();
        setResolutions(updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add resolution";
        showToast(message, "warning");
      }
    },
    [showToast]
  );

  const handleRemoveResolution = useCallback(async (id: number) => {
    try {
      await deleteResolution(id);
      setResolutions((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove resolution";
      showToast(message, "warning");
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveSlot(null);
  }, []);

  const handleGoToCourse = useCallback((year: number, plannedCourseId: number) => {
    setHighlightedPlannedCourseId(plannedCourseId);
    router.push(`/planner/${year}`);
    window.setTimeout(() => {
      setHighlightedPlannedCourseId((current) => (current === plannedCourseId ? null : current));
    }, 2000);
  }, [router]);

  const handleCourseClick = useCallback((planned: PlannedCourse) => {
    const slug = getCourseSlug({
      title: planned.course.title,
      normalizedTitle: planned.course.normalizedTitle,
    });
    router.push(`/catalog/${slug}?return=${encodeURIComponent(`/planner/${year}`)}`);
  }, [router, year]);

  const handleCourseSelected = useCallback(
    async (selection: { courseId: number } | { plannerOptionId: number }) => {
      if (!planner || !activeSlot) return;

      try {
        scrollYRef.current = window.scrollY;
        const beforePlanners = allPlanners;
        const updatedPlanner =
          "courseId" in selection
            ? await plannerService.addPlannedCourse(
                planner.id,
                selection.courseId,
                activeSlot.semester,
                activeSlot.slot
              )
            : await plannerService.addPlannedCourse(planner.id, {
                plannerOptionId: selection.plannerOptionId,
                semester: activeSlot.semester,
                slot: activeSlot.slot,
              });
        const newPlanners = replacePlannerInList(beforePlanners, updatedPlanner);
        pushHistory(
          newPlanners,
          buildAddCourseUndo(beforePlanners, updatedPlanner, plannerService.removePlannedCourse, plannerService.movePlannedCourse)
        );
        handleCloseModal();
        showToast("Course added.", "success", handleUndo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add course";
        showToast(message, "warning");
      }
    },
    [planner, activeSlot, allPlanners, handleCloseModal, pushHistory, showToast, handleUndo, plannerService]
  );

  const handleAddPrerequisiteToPlanner = useCallback(
    async (plannerId: number, courseId: number, semester: number, slot: number) => {
      const targetPlanner = allPlanners.find((p) => p.id === plannerId);
      if (!targetPlanner) return;

      try {
        scrollYRef.current = window.scrollY;
        const beforePlanners = allPlanners;
        const updatedPlanner = await plannerService.addPlannedCourse(targetPlanner.id, courseId, semester, slot);
        const newPlanners = replacePlannerInList(beforePlanners, updatedPlanner);
        pushHistory(
          newPlanners,
          buildAddCourseUndo(beforePlanners, updatedPlanner, plannerService.removePlannedCourse, plannerService.movePlannedCourse)
        );
        setAllPlanners(newPlanners);
        setPlanner(newPlanners.find((p) => p.schoolYear === year) || null);
        showToast("Prerequisite added.", "success", handleUndo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add prerequisite";
        showToast(message, "warning");
        throw err;
      }
    },
    [allPlanners, pushHistory, showToast, handleUndo, year, plannerService]
  );

  const handleRemoveCourse = useCallback(
    async (planned: PlannedCourse) => {
      try {
        scrollYRef.current = window.scrollY;
        const hasMultiSlot = (planned.slotSpan ?? 1) > 1 || planned.course.duration === 2;
        const removedEntries = allPlanners
          .find((p) => p.id === planned.plannerId)
          ?.plannedCourses.filter((pc) =>
            hasMultiSlot
              ? pc.courseId === planned.courseId
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

        await plannerService.removePlannedCourse(planned.id);
        pushHistory(newPlanners, async () => {
          let restoredPlanner: Planner;
          if (planned.courseId != null) {
            restoredPlanner = await plannerService.addPlannedCourse(
              planned.plannerId,
              planned.courseId,
              planned.semester,
              planned.slot
            );
          } else if (planned.plannerOptionId != null) {
            restoredPlanner = await plannerService.addPlannedCourse(planned.plannerId, {
              plannerOptionId: planned.plannerOptionId,
              semester: planned.semester,
              slot: planned.slot,
            });
          } else {
            throw new Error("Cannot restore planned course: missing courseId and plannerOptionId");
          }
          undoRestoredPlannerRef.current = restoredPlanner;
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
      scrollYRef.current = window.scrollY;
      const source = allPlanners.flatMap((p) => p.plannedCourses).find((pc) => pc.id === plannedCourseId);
      if (!source) return;
      if (source.semester === semester && source.slot === slot && source.course.duration !== 2) return;
      if (source.course.duration === 2 && source.slot === slot) return;

      const originalPlanners = clonePlanners(allPlanners);
      const optimisticPlanners = applyOptimisticMove(allPlanners, source, semester, slot);
      if (optimisticPlanners !== originalPlanners) {
        setAllPlanners(optimisticPlanners);
        setPlanner(optimisticPlanners.find((p) => p.schoolYear === year) || null);
      }

      try {
        const updatedPlanner = await plannerService.movePlannedCourse(plannedCourseId, semester, slot);
        const newPlanners = allPlanners.map((p) =>
          p.schoolYear === updatedPlanner.schoolYear ? updatedPlanner : p
        );
        pushHistory(newPlanners, async () => {
          await plannerService.movePlannedCourse(plannedCourseId, source.semester, source.slot);
        });
        showToast("Course moved.", "success", handleUndo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to move course";
        showToast(message, "warning");
        setAllPlanners(originalPlanners);
        setPlanner(originalPlanners.find((p) => p.schoolYear === year) || null);
      }
    },
    [allPlanners, pushHistory, showToast, handleUndo, year, plannerService]
  );

  const handleDrop = useCallback(
    async (plannedCourseId: number, targetSemester: number, targetSlot: number) => {
      setDraggingId(null);
      setDragOverSlot(null);
      await handleMove(plannedCourseId, targetSemester, targetSlot);
    },
    [handleMove]
  );

  const getOccupiedSlots = (planned: PlannedCourse): number[] => {
    const span = planned.slotSpan ?? 1;
    return Array.from({ length: span }, (_, i) => planned.slot + i);
  };

  const plannedBySlot = (semester: number, slot: number) =>
    planner?.plannedCourses.find(
      (course) => course.semester === semester && course.slot <= slot && slot < course.slot + (course.slotSpan ?? 1)
    );

  const MUTLI_SLOT_PLACEHOLDER_STYLE: React.CSSProperties = {
    height: "100px",
    background: "linear-gradient(135deg, rgba(39, 93, 56, 0.04) 0%, rgba(39, 93, 56, 0.02) 100%)",
    borderRadius: "8px",
    border: "1px dashed rgba(39, 93, 56, 0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    color: "var(--text-tertiary, #999)",
    cursor: "default",
  };

  const renderSlot = (semester: number, slot: number) => {
    const planned = plannedBySlot(semester, slot);

    if (planned) {
      // Multi-slot courses only render the card on their primary (first) slot.
      if ((planned.slotSpan ?? 1) > 1 && planned.slot !== slot) {
        return (
          <div key={`${semester}-${slot}`} style={MUTLI_SLOT_PLACEHOLDER_STYLE}>
            {planned.course.title} (cont.)
          </div>
        );
      }
      return (
        <PlannedCourseCard
          key={`${semester}-${slot}`}
          planned={planned}
          warnings={getWarnings(
            planned,
            allPlanners,
            completedCourses,
            allCatalogCourses,
            semester,
            year
          ).filter((w) => !ignoredWarnings.has(makeWarningKey(planned, w)))}
          isDragging={draggingId === planned.id}
          isDragOver={dragOverSlot?.semester === semester && dragOverSlot?.slot === slot}
          isHighlighted={highlightedPlannedCourseId === planned.id}
          onRemove={() => handleRemoveCourse(planned)}
          onClick={() => handleCourseClick(planned)}
          onWarningClick={(w) => setSelectedWarning({ planned, warning: w })}
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
        minHeight: "calc(100vh - 64px)",
      }}
    >
      <Link
        href="/planner"
        style={{
          display: "inline-block",
          marginBottom: "16px",
          fontSize: "14px",
          color: "var(--text-secondary)",
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
              color: "#111827",
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
                      fontWeight: 700,
                      color: "#111827",
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
      <SummarySidebar
        planners={allPlanners}
        currentYear={year}
        resolutions={resolutions}
        plannerAnalysis={plannerAnalysis}
        onAddResolution={handleAddResolution}
        onRemoveResolution={handleRemoveResolution}
      />
        )}
      </div>

      {activeSlot && planner && (
        <CourseSearchModal
          onClose={handleCloseModal}
          onSelect={handleCourseSelected}
          isSaved={isSaved}
          grade={year}
          allPlanners={allPlanners}
          onGoToCourse={handleGoToCourse}
        />
      )}

      {selectedWarning && (
        <WarningActionModal
          planned={selectedWarning.planned}
          warning={selectedWarning.warning}
          allPlanners={allPlanners}
          allCatalogCourses={allCatalogCourses}
          currentYear={year}
          onClose={() => setSelectedWarning(null)}
          onAddToPlanner={handleAddPrerequisiteToPlanner}
          onSwapSemesters={handleMove}
          onIgnore={() =>
            persistIgnoredWarning(makeWarningKey(selectedWarning.planned, selectedWarning.warning))
          }
          onMarkCompleted={(completed) =>
            setCompletedCourses((prev) => [...prev, completed])
          }
          onPlacementTest={async (courseId, grade) => {
            const completed = await completedService.addCompletedCourse(courseId, grade);
            setCompletedCourses((prev) => [...prev, completed]);
          }}
          onMiddleSchool={async (courseId, grade) => {
            await createResolution({ type: "middle_school", courseId, metadata: { grade } });
            const completed = await completedService.addCompletedCourse(courseId, grade);
            setCompletedCourses((prev) => [...prev, completed]);
            const data = await getResolutions();
            setResolutions(data);
          }}
          onSummerSchool={async (courseId, grade) => {
            await createResolution({ type: "summer_school", courseId, metadata: { grade } });
            const completed = await completedService.addCompletedCourse(courseId, grade);
            setCompletedCourses((prev) => [...prev, completed]);
            const data = await getResolutions();
            setResolutions(data);
          }}
          showToast={showToast}
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
  resolutions,
  plannerAnalysis,
  onAddResolution,
  onRemoveResolution,
}: {
  planners: Planner[];
  currentYear: number;
  resolutions: RequirementResolution[];
  plannerAnalysis: PlannerAnalysis | null;
  onAddResolution: (data: { type: string; courseId?: number; metadata?: Record<string, unknown> }) => void;
  onRemoveResolution: (id: number) => void;
}): React.ReactElement {
  const currentPlanner = planners.find((p) => p.schoolYear === currentYear);
  const allCourses = planners.flatMap((p) => p.plannedCourses);

  const totalCredits = sumPlannedCredits(allCourses);
  const currentCredits = sumPlannedCredits(currentPlanner?.plannedCourses || []);
  const courseKeys = new Set<string>();
  const fullYearKeys = new Set<string>();
  for (const pc of currentPlanner?.plannedCourses || []) {
    const key = pc.courseId != null
      ? `c${pc.courseId}`
      : (pc.plannerOptionId != null ? `c${-pc.plannerOptionId}` : `i${pc.id}`);
    courseKeys.add(key);
    if (pc.course.duration === 2) {
      fullYearKeys.add(key);
    }
  }
  const currentCourseCount = courseKeys.size;
  const fullYearCount = fullYearKeys.size;
  const semesterCount = currentCourseCount - fullYearCount;
  const totalSlots = 14;
  const filledSlots = (currentPlanner?.plannedCourses || []).length;
  const slotPercentage = totalSlots > 0 ? Math.min(100, (filledSlots / totalSlots) * 100) : 0;

  return (
    <aside
      style={{
        flex: "0 0 320px",
        minWidth: "280px",
        maxWidth: "100%",
        padding: "24px",
        backgroundColor: "#ffffff",
        border: "2px solid #275D38",
        borderRadius: "16px",
      }}
    >
      <h2
        style={{
          margin: "0 0 20px",
          fontSize: "18px",
          fontWeight: 700,
          color: "#111827",
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
      </div>

      <GradeRequirements
        grade={currentYear}
        requirements={
          plannerAnalysis?.yearRequirements
            .find((yr) => yr.grade === currentYear)
            ?.items.map((item) => ({
              category: item.category,
              requiredCredits: item.requiredCredits,
              earnedCredits: item.earnedCredits,
              isMet: item.met,
            })) ?? []
        }
        pePerSemester={
          plannerAnalysis?.peSemesterBreakdown
            .filter((s) => {
              const gradeStart = (currentYear - 9) * 2 + 1;
              return s.semester >= gradeStart && s.semester < gradeStart + 2;
            })
            .map((s) => ({
              semester: s.semester - (currentYear - 9) * 2,
              isMet: s.met,
              courseTitle: s.courseTitle,
              requiredLabel: s.requiredLabel,
            })) as PeSemesterStatus[] | undefined
        }
        peWaivers={resolutions
          .filter((r) => r.type === "pe_waiver")
          .map((r) => {
            const variant = r.metadata?.variant as string | undefined;
            if (variant === "athletic") {
              const av = r.metadata?.athleticVariant as "credit" | "non-credit" | undefined;
              return { type: "athletic" as const, variant: av ?? "credit" };
            }
            if (variant === "marching-band") return { type: "marching-band" as const };
            return { type: "academic" as const };
          })}
      />

      <WaiverSection
        grade={currentYear}
        plannedCourses={currentPlanner?.plannedCourses ?? []}
        resolutions={resolutions}
        onAddResolution={onAddResolution}
        onRemoveResolution={onRemoveResolution}
      />

      <CourseLoadRequirements
        requirements={computeCourseLoadRequirements(
          currentPlanner?.plannedCourses ?? [],
          currentYear
        )}
      />

      <div
        style={{
          marginTop: "24px",
          paddingTop: "20px",
          borderTop: "1px solid var(--border-default)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            fontSize: "14px",
            color: "var(--text-secondary)",
          }}
        >
          <span>Course Slots Filled</span>
          <span>
            {filledSlots} / {totalSlots}
          </span>
        </div>
        <div
          style={{
            height: "8px",
            backgroundColor: "var(--bg-muted)",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${slotPercentage}%`,
              height: "100%",
              backgroundColor: "var(--brand-accent)",
              borderRadius: "9999px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
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
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: 400, color: "#111827" }}>{value}</span>
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
        backgroundColor: isDragOver ? "rgba(201, 154, 44, 0.12)" : "#1f2937",
        border: `2px dashed ${isDragOver ? "var(--brand-accent)" : "#4b5563"}`,
        borderRadius: "12px",
        cursor: "pointer",
        color: isDragOver ? "var(--brand-accent)" : "#9ca3af",
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
  isHighlighted,
  onRemove,
  onClick,
  onWarningClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  planned: PlannedCourse;
  warnings: PlannerWarning[];
  isDragging: boolean;
  isDragOver: boolean;
  isHighlighted: boolean;
  onRemove: () => void;
  onClick: () => void;
  onWarningClick: (warning: PlannerWarning) => void;
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
        backgroundColor: isDragOver ? "rgba(201, 154, 44, 0.12)" : bgTint,
        borderTopWidth: "1px",
        borderRightWidth: "1px",
        borderBottomWidth: "1px",
        borderLeftWidth: "4px",
        borderTopStyle: "solid",
        borderRightStyle: "solid",
        borderBottomStyle: "solid",
        borderLeftStyle: "solid",
        borderTopColor: isDragOver ? "var(--brand-accent)" : accentColor,
        borderRightColor: isDragOver ? "var(--brand-accent)" : accentColor,
        borderBottomColor: isDragOver ? "var(--brand-accent)" : accentColor,
        borderLeftColor: isDragOver ? "var(--brand-accent)" : accentColor,
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minHeight: "120px",
        cursor: "move",
        opacity: isDragging ? 0.5 : 1,
        transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
        transform: isDragOver ? "scale(1.02)" : isHighlighted ? "scale(1.03)" : "scale(1)",
        boxShadow: isDragOver
          ? "0 0 0 2px rgba(236, 186, 43, 0.4)"
          : isHighlighted
          ? "0 0 0 4px rgba(236, 186, 43, 0.6), 0 6px 16px rgba(0,0,0,0.15)"
          : "none",
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
            color: "var(--text-secondary)",
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
            e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)";
            e.currentTarget.style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          🗑
        </button>
      </div>

      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#111827",
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
          color: "var(--text-secondary)",
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
            {formatCreditType(course.creditType)}
          </span>
        )}
        {course.credits != null && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "rgba(0,0,0,0.2)",
              borderRadius: "9999px",
              fontWeight: 600,
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
              fontWeight: 600,
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
            backgroundColor: "rgba(236, 186, 43, 0.12)",
            border: "1px solid rgba(236, 186, 43, 0.3)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "var(--brand-accent)",
            lineHeight: 1.4,
          }}
        >
          {warnings.map((w, i) => (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onWarningClick(w);
              }}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              ⚠ {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getPlannedCourseLocation(allPlanners: Planner[], courseId: number) {
  for (const planner of allPlanners) {
    const entries = planner.plannedCourses.filter((pc) => pc.courseId === courseId);
    if (entries.length > 0) {
      const sorted = [...entries].sort((a, b) => a.semester - b.semester);
      const slot = sorted[0].slot;
      const isFullYear =
        sorted.length >= 2 && sorted[0].semester === 1 && sorted[sorted.length - 1].semester === 2;
      return {
        year: planner.schoolYear,
        label: YEAR_LABELS[planner.schoolYear],
        semester: isFullYear ? ("Full Year" as const) : (sorted[0].semester as 1 | 2),
        slot,
        plannedCourseId: sorted[0].id,
      };
    }
  }
  return null;
}

function isDuplicateCourse(course: PlannerCourseDetails, allPlanners: Planner[]): boolean {
  if (course.id < 0) return false;
  return allPlanners.some((planner) => planner.plannedCourses.some((pc) => pc.courseId === course.id));
}

function CourseSearchModal({
  onClose,
  onSelect,
  isSaved,
  grade,
  allPlanners,
  onGoToCourse,
}: {
  onClose: () => void;
  onSelect: (selection: { courseId: number } | { plannerOptionId: number }) => void;
  isSaved: (courseId: number) => boolean;
  grade: number;
  allPlanners: Planner[];
  onGoToCourse: (year: number, plannedCourseId: number) => void;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("All Divisions");
  const [allCourses, setAllCourses] = useState<PlannerCourseDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicateCourse, setDuplicateCourse] = useState<PlannerCourseDetails | null>(null);
  const duplicateLocation = useMemo(
    () => (duplicateCourse ? getPlannedCourseLocation(allPlanners, duplicateCourse.id) : null),
    [duplicateCourse, allPlanners]
  );

  const { planner: modalPlannerService } = useServices();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCourses().then((courses) => courses.map(courseToPlannerDetails)),
      modalPlannerService.getPlannerOptions(grade).then((options) => options.map(plannerOptionToPlannerDetails)),
    ])
      .then(([courses, options]) => setAllCourses([...options, ...courses]))
      .catch(() => setAllCourses([]))
      .finally(() => setLoading(false));
  }, [grade]);

  const divisions = useMemo(
    () => extractDivisionsFromItems(allCourses, (course) => course.division),
    [allCourses]
  );

  const filteredResults = allCourses.filter(
    (course) =>
      courseMatchesQuery(course, query) &&
      courseMatchesDivisionFilter(
        course.division,
        selectedDivision === "All Divisions" ? null : selectedDivision
      )
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
                fontWeight: 700,
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

          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            aria-label="Filter by division"
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "12px 16px",
              fontSize: "15px",
              color: "#ffffff",
              backgroundColor: "#111827",
              border: "1px solid #4b5563",
              borderRadius: "10px",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="All Divisions">All Divisions</option>
            {divisions.map((division) => (
              <option key={division} value={division}>
                {division}
              </option>
            ))}
          </select>
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
              {(() => {
                const hasQuery = query.trim().length > 0;
                const hasDivision = selectedDivision !== "All Divisions";
                if (hasQuery && hasDivision) {
                  return "No courses match your search and division filter.";
                }
                if (hasQuery) {
                  return "No courses match your search.";
                }
                if (hasDivision) {
                  return "No courses match the selected division.";
                }
                return "No courses available.";
              })()}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {sortedResults.map((course) => {
                const isDuplicate = isDuplicateCourse(course, allPlanners);
                return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => {
                    if (isDuplicate) {
                      setDuplicateCourse(course);
                      return;
                    }
                    onSelect(
                      course.id < 0 ? { plannerOptionId: -course.id } : { courseId: course.id }
                    );
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "16px",
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "12px",
                    cursor: isDuplicate ? "not-allowed" : "pointer",
                    textAlign: "left",
                    color: "inherit",
                    width: "100%",
                    opacity: isDuplicate ? 0.5 : 1,
                    transition: "border-color 0.15s ease, opacity 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDuplicate) {
                      e.currentTarget.style.borderColor = "#4b5563";
                    }
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
                            color: "var(--brand-accent)",
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
                          {formatCreditType(course.creditType)}
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
                      fontWeight: 500,
                      color: isDuplicate ? "#6b7280" : "var(--brand-accent)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isDuplicate ? "Already planned" : "Add →"}
                  </span>
                </button>
              );
              })}
            </div>
          )}
        </div>
      </div>

      {duplicateCourse && duplicateLocation && (
        <DuplicateCourseDialog
          course={duplicateCourse}
          location={duplicateLocation}
          onGoToCourse={() => {
            onGoToCourse(duplicateLocation.year, duplicateLocation.plannedCourseId);
            onClose();
          }}
          onClose={() => setDuplicateCourse(null)}
        />
      )}
    </div>
  );
}

function DuplicateCourseDialog({
  course,
  location,
  onGoToCourse,
  onClose,
}: {
  course: PlannerCourseDetails;
  location: { label: string; semester: "Full Year" | 1 | 2; slot: number };
  onGoToCourse: () => void;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
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
          color: "#ffffff",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: "0 0 16px",
            fontSize: "20px",
            fontWeight: 700,
          }}
        >
          This course is already planned
        </h3>
        <div style={{ marginBottom: "24px", lineHeight: 1.5, color: "#d1d5db" }}>
          <p style={{ margin: "0 0 12px", fontWeight: 500, color: "#ffffff" }}>{course.title}</p>
          <div style={{ fontSize: "14px", color: "#9ca3af" }}>
            <div>
              Location: <strong style={{ color: "#ffffff" }}>{location.label}</strong>
            </div>
            <div>
              Semester: <strong style={{ color: "#ffffff" }}>{location.semester}</strong>
            </div>
            <div>
              Slot: <strong style={{ color: "#ffffff" }}>{location.slot}</strong>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
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
            onClick={onGoToCourse}
            style={{
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#ffffff",
              backgroundColor: "var(--brand-accent)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Go to Course
          </button>
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
            fontWeight: 500,
            color: "#ffffff",
            backgroundColor: "var(--brand-accent)",
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

type PlannerWarning = {
  message: string;
  type: "missing_prerequisite" | "later_prerequisite";
  prerequisite: string;
  prerequisitePlacement?: {
    id: number;
    plannerId: number;
    year: number;
    semester: number;
    slot: number;
    courseId: number;
  };
};

function getCourseIdentityKey(planned: PlannedCourse): string {
  const id = planned.courseId ?? (planned.plannerOptionId != null ? -planned.plannerOptionId : null);
  return id != null ? `c${id}` : `i${planned.id}`;
}

function makeWarningKey(planned: PlannedCourse, warning: PlannerWarning): string {
  return `${getCourseIdentityKey(planned)}-${warning.type}-${warning.prerequisite}`;
}

function getWarnings(
  planned: PlannedCourse,
  allPlanners: Planner[],
  completedCourses: CompletedCourse[],
  allCatalogCourses: PlannerCourseDetails[],
  currentSemester: number,
  currentYear: number
): PlannerWarning[] {
  const warnings: PlannerWarning[] = [];
  const { course } = planned;

  if (!course.prerequisites || course.prerequisites.length === 0) {
    return warnings;
  }

  const completedCourseIds = new Set(completedCourses.map((cc) => cc.courseId));

  const plannedPlacements: Array<{
    id: number;
    plannerId: number;
    year: number;
    semester: number;
    slot: number;
    courseId: number;
  }> = [];
  for (const p of allPlanners) {
    for (const pc of p.plannedCourses) {
      if (pc.courseId == null) continue;
      plannedPlacements.push({
        id: pc.id,
        plannerId: pc.plannerId,
        year: p.schoolYear,
        semester: pc.semester,
        slot: pc.slot,
        courseId: pc.courseId,
      });
    }
  }

  plannedPlacements.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.semester !== b.semester) return a.semester - b.semester;
    return a.slot - b.slot;
  });

  const plannedCourseId = planned.courseId;
  if (plannedCourseId == null) {
    return warnings;
  }

  const effectiveSemester = course.duration === 2 ? 1 : currentSemester;

  for (const prereq of course.prerequisites) {
    if (!prereq.trim()) continue;

    const matchedCourses = allCatalogCourses.filter((c) =>
      prerequisiteMatches(prereq, c.title, c.courseCode)
    );
    const matchedCourseIds = matchedCourses.map((c) => c.id);

    if (matchedCourseIds.length === 0) {
      continue;
    }

    const isCompleted = matchedCourseIds.some((id) => completedCourseIds.has(id));
    if (isCompleted) {
      continue;
    }

    const prereqPlacements = plannedPlacements.filter((item) =>
      matchedCourseIds.includes(item.courseId)
    );
    const isPrerequisiteSatisfied = prereqPlacements.some(
      (item) =>
        item.year < currentYear ||
        (item.year === currentYear && item.semester === 1 && effectiveSemester === 2)
    );

    if (prereqPlacements.length === 0) {
      warnings.push({
        message: `${course.title} usually requires ${formatPrerequisiteForDisplay(prereq)} first.`,
        type: "missing_prerequisite",
        prerequisite: prereq,
      });
    } else if (!isPrerequisiteSatisfied) {
      const prerequisitePlacement =
        prereqPlacements.find(
          (item) =>
            item.year === currentYear && item.semester === 2 && effectiveSemester === 1
        ) ?? prereqPlacements[0];
      warnings.push({
        message: `A prerequisite for this course is not scheduled before it.`,
        type: "later_prerequisite",
        prerequisite: prereq,
        prerequisitePlacement,
      });
    }
  }

  return warnings;
}

function WarningActionModal({
  planned,
  warning,
  allPlanners,
  allCatalogCourses,
  currentYear,
  onClose,
  onAddToPlanner,
  onSwapSemesters,
  onIgnore,
  onMarkCompleted,
  onPlacementTest,
  onMiddleSchool,
  onSummerSchool,
  showToast,
}: {
  planned: PlannedCourse;
  warning: PlannerWarning;
  allPlanners: Planner[];
  allCatalogCourses: PlannerCourseDetails[];
  currentYear: number;
  onClose: () => void;
  onAddToPlanner: (plannerId: number, courseId: number, semester: number, slot: number) => Promise<void>;
  onSwapSemesters: (plannedCourseId: number, semester: number, slot: number) => Promise<void>;
  onIgnore: () => void;
  onMarkCompleted: (completed: CompletedCourse) => void;
  onPlacementTest: (courseId: number, grade: GradeCompleted) => Promise<void>;
  onMiddleSchool: (courseId: number, grade: GradeCompleted) => Promise<void>;
  onSummerSchool: (courseId: number, grade: GradeCompleted) => Promise<void>;
  showToast: (message: string, type?: ToastType, onUndo?: () => void) => void;
}): React.ReactElement {
  const { completedCourses: modalCompletedService } = useServices();
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [showConfirmIgnore, setShowConfirmIgnore] = useState(false);

  const allCourses = allCatalogCourses;

  const matchedCourses = useMemo(() => {
    return allCourses.filter((c) =>
      prerequisiteMatches(warning.prerequisite, c.title, c.courseCode)
    );
  }, [allCourses, warning.prerequisite]);

  const selectedCourse =
    matchedCourses.find((c) => c.id === selectedCourseId) ?? matchedCourses[0] ?? null;

  useEffect(() => {
    if (matchedCourses.length === 0) {
      setSelectedCourseId(null);
      return;
    }
    if (selectedCourseId == null || !matchedCourses.some((c) => c.id === selectedCourseId)) {
      setSelectedCourseId(matchedCourses[0].id);
    }
  }, [matchedCourses, selectedCourseId]);

  const previousYears = useMemo(() => {
    return [9, 10, 11, 12].filter((y) => y < currentYear);
  }, [currentYear]);

  const hasPreviousYears = previousYears.length > 0;

  const getFirstEmptySlot = useCallback(
    (year: number) => {
      const planner = allPlanners.find((p) => p.schoolYear === year);
      if (!planner) return null;
      for (const semester of [1, 2]) {
        for (const slot of [1, 2, 3, 4, 5, 6, 7]) {
          const occupied = planner.plannedCourses.find(
            (pc) => pc.semester === semester && pc.slot === slot
          );
          if (!occupied) return { semester, slot };
        }
      }
      return null;
    },
    [allPlanners]
  );

  const getGradeCompleted = (): GradeCompleted =>
    currentYear === 9
      ? "Middle School"
      : currentYear === 10
      ? "Sophomore (10)"
      : currentYear === 11
      ? "Junior (11)"
      : "Senior (12)";

  const handleMarkCompleted = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      const completed = await modalCompletedService.addCompletedCourse(selectedCourse.id, getGradeCompleted());
      onMarkCompleted(completed);
      showToast("Marked as completed.", "success");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to mark completed";
      showToast(message, "warning");
    } finally {
      setLoading(false);
    }
  };

  const handlePlacementTest = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      await onPlacementTest(selectedCourse.id, getGradeCompleted());
      showToast("Placement test recorded.", "success");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record placement test";
      showToast(message, "warning");
    } finally {
      setLoading(false);
    }
  };

  const handleMiddleSchool = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      await onMiddleSchool(selectedCourse.id, getGradeCompleted());
      showToast("Marked as completed in middle school.", "success");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record middle school completion";
      showToast(message, "warning");
    } finally {
      setLoading(false);
    }
  };

  const handleSummerSchool = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      await onSummerSchool(selectedCourse.id, getGradeCompleted());
      showToast("Marked as completed in summer school.", "success");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record summer school completion";
      showToast(message, "warning");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrerequisite = async () => {
    if (!selectedCourse || selectedYear == null) return;
    const emptySlot = getFirstEmptySlot(selectedYear);
    if (!emptySlot) return;
    const targetPlanner = allPlanners.find((p) => p.schoolYear === selectedYear);
    if (!targetPlanner) return;
    setLoading(true);
    try {
      await onAddToPlanner(targetPlanner.id, selectedCourse.id, emptySlot.semester, emptySlot.slot);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add prerequisite";
      showToast(message, "warning");
    } finally {
      setLoading(false);
    }
  };

  const handleSwapSemesters = async () => {
    const prerequisitePlacement = warning.prerequisitePlacement;
    if (!prerequisitePlacement) return;
    setLoading(true);
    try {
      await onSwapSemesters(prerequisitePlacement.id, planned.semester, planned.slot);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to swap semesters";
      showToast(message, "warning");
    } finally {
      setLoading(false);
    }
  };

  const handleIgnore = () => {
    setShowConfirmIgnore(true);
  };

  const confirmIgnore = () => {
    onIgnore();
    setShowConfirmIgnore(false);
    onClose();
  };

  const cancelIgnore = () => {
    setShowConfirmIgnore(false);
  };

  const canAddPrerequisite =
    hasPreviousYears &&
    warning.type === "missing_prerequisite" &&
    selectedCourse != null &&
    selectedYear != null &&
    getFirstEmptySlot(selectedYear) != null;

  const prerequisitePlacement = warning.prerequisitePlacement;
  const canSwapSemesters =
    warning.type === "later_prerequisite" &&
    prerequisitePlacement?.plannerId === planned.plannerId &&
    prerequisitePlacement.semester === 2 &&
    planned.semester === 1;

  const hasPlacementTestOption = useMemo(() => {
    const text = warning.prerequisite?.toLowerCase() ?? "";
    return text.includes("placement exam") || text.includes("placement test");
  }, [warning.prerequisite]);

  const placementTestHelpText = hasPlacementTestOption
    ? "You may also satisfy this prerequisite by completing a placement test."
    : "";

  const addPrerequisiteHelpText =
    warning.type !== "missing_prerequisite"
      ? ""
      : !hasPreviousYears
      ? "No previous school years are available."
      : matchedCourses.length === 0
      ? "No matching course was found for this prerequisite."
      : selectedCourse == null
      ? "Select a matching course to add the prerequisite."
      : selectedYear == null
      ? "Select a previous year to add the prerequisite."
      : getFirstEmptySlot(selectedYear) == null
      ? "The selected year has no empty slots."
      : "";

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
          maxWidth: "480px",
          maxHeight: "80vh",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              Resolve Warning
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
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "rgba(236, 186, 43, 0.12)",
              border: "1px solid rgba(236, 186, 43, 0.3)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--brand-accent)",
              lineHeight: 1.5,
            }}
          >
            ⚠ {warning.message}
          </div>

          {loading ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>Loading...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {matchedCourses.length > 1 && (
                <select
                  value={selectedCourseId ?? ""}
                  onChange={(e) =>
                    setSelectedCourseId(e.target.value ? Number(e.target.value) : null)
                  }
                  aria-label="Select prerequisite course"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: "15px",
                    color: "#ffffff",
                    backgroundColor: "#111827",
                    border: "1px solid #4b5563",
                    borderRadius: "8px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">Select a prerequisite course</option>
                  {matchedCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}

              {matchedCourses.length === 0 && (
                <p style={{ margin: 0, fontSize: "14px", color: "#9ca3af", textAlign: "center" }}>
                  No matching course was found for this prerequisite.
                </p>
              )}

              {placementTestHelpText && (
                <p style={{ margin: 0, fontSize: "13px", color: "#d1d5db", lineHeight: 1.4, textAlign: "center" }}>
                  {placementTestHelpText}
                </p>
              )}

              <button
                type="button"
                onClick={handleMarkCompleted}
                disabled={loading || selectedCourse == null}
                style={{
                  padding: "12px 16px",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "#ffffff",
                  backgroundColor: "var(--brand-accent)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: selectedCourse ? "pointer" : "not-allowed",
                  textAlign: "left",
                  opacity: selectedCourse ? 1 : 0.5,
                }}
              >
                I already completed this course
              </button>

              {hasPlacementTestOption && (
                <button
                  type="button"
                  onClick={handlePlacementTest}
                  disabled={loading || selectedCourse == null}
                  style={{
                    padding: "12px 16px",
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "#ffffff",
                    backgroundColor: "var(--brand-primary)",
                    border: "none",
                    borderRadius: "8px",
                    cursor: selectedCourse ? "pointer" : "not-allowed",
                    textAlign: "left",
                    opacity: selectedCourse ? 1 : 0.5,
                  }}
                >
                  Completed Placement Test
                </button>
              )}

              <button
                type="button"
                onClick={handleMiddleSchool}
                disabled={loading || selectedCourse == null}
                style={{
                  padding: "12px 16px",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "#ffffff",
                  backgroundColor: "var(--brand-primary)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: selectedCourse ? "pointer" : "not-allowed",
                  textAlign: "left",
                  opacity: selectedCourse ? 1 : 0.5,
                }}
              >
                Completed in Middle School
              </button>

              <button
                type="button"
                onClick={handleSummerSchool}
                disabled={loading || selectedCourse == null}
                style={{
                  padding: "12px 16px",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "#ffffff",
                  backgroundColor: "var(--brand-primary)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: selectedCourse ? "pointer" : "not-allowed",
                  textAlign: "left",
                  opacity: selectedCourse ? 1 : 0.5,
                }}
              >
                Completed in Summer School
              </button>

              {canSwapSemesters && (
                <button
                  type="button"
                  onClick={handleSwapSemesters}
                  disabled={loading}
                  style={{
                    padding: "12px 16px",
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "#ffffff",
                    backgroundColor: "var(--brand-primary)",
                    border: "none",
                    borderRadius: "8px",
                    cursor: loading ? "not-allowed" : "pointer",
                    textAlign: "left",
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  Swap semesters
                </button>
              )}

              {hasPreviousYears && warning.type === "missing_prerequisite" && (
                <>
                  <select
                    value={selectedYear ?? ""}
                    onChange={(e) =>
                      setSelectedYear(e.target.value ? Number(e.target.value) : null)
                    }
                    disabled={matchedCourses.length === 0}
                    aria-label="Select previous year"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: "15px",
                      color: "#ffffff",
                      backgroundColor: "#111827",
                      border: "1px solid #4b5563",
                      borderRadius: "8px",
                      outline: "none",
                      cursor: matchedCourses.length === 0 ? "not-allowed" : "pointer",
                      opacity: matchedCourses.length === 0 ? 0.5 : 1,
                    }}
                  >
                    <option value="">Select previous year</option>
                    {previousYears.map((y) => {
                      const emptySlot = getFirstEmptySlot(y);
                      return (
                        <option key={y} value={y} disabled={!emptySlot}>
                          {YEAR_LABELS[y]} {emptySlot ? "" : "(no empty slots)"}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    onClick={handleAddPrerequisite}
                    disabled={loading || !canAddPrerequisite}
                    style={{
                      padding: "12px 16px",
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "#ffffff",
                      backgroundColor: "var(--brand-accent)",
                      border: "none",
                      borderRadius: "8px",
                      cursor: canAddPrerequisite ? "pointer" : "not-allowed",
                      textAlign: "left",
                      opacity: canAddPrerequisite ? 1 : 0.5,
                    }}
                  >
                    Add {selectedCourse?.title ?? "prerequisite"} to{" "}
                    {selectedYear ? YEAR_LABELS[selectedYear] : "previous year"}
                  </button>
                </>
              )}

              {addPrerequisiteHelpText && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#9ca3af",
                    lineHeight: 1.4,
                  }}
                >
                  {addPrerequisiteHelpText}
                </p>
              )}
            </div>
          )}

          <div
            style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #374151" }}
          >
            {!showConfirmIgnore ? (
              <button
                type="button"
                onClick={handleIgnore}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "#d1d5db",
                  backgroundColor: "transparent",
                  border: "1px solid #4b5563",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Ignore Warning
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "#d1d5db",
                    textAlign: "center",
                  }}
                >
                  Are you sure you want to ignore this warning?
                </p>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={confirmIgnore}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "#ffffff",
                      backgroundColor: "#dc2626",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    Yes, ignore
                  </button>
                  <button
                    type="button"
                    onClick={cancelIgnore}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "#d1d5db",
                      backgroundColor: "#374151",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

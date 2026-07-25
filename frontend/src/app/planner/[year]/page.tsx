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
import { GuestUpgradePrompt } from "@/components/auth/GuestUpgradePrompt";
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
  buildCourseSearchIndex,
  courseMatchesQuery,
  courseMatchesDivisionFilter,
  extractDivisionsFromItems,
  formatCreditType,
  formatPrerequisiteForDisplay,
} from "@/lib/catalog";
import {
  type CompletedCourse,
  GRADE_COMPLETED_OPTIONS,
  type GradeCompleted,
} from "@/lib/completedCourses";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";
import type { StudentPlanningData } from "@/lib/studentData";
import { CompletedCoursePicker } from "@/components/planner/CompletedCoursePicker";
import { EarlyBirdModal } from "@/components/planner/EarlyBirdModal";
import { normalizePrerequisite, prerequisiteMatches } from "@/lib/prerequisiteNormalization";
import { computeCourseLoadRequirements } from "@/lib/courseLoadRequirements";
import { CourseLoadRequirements } from "@/components/planner/CourseLoadRequirements";
import { WaiverSection } from "@/components/planner/WaiverSection";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useSearchSubmit } from "@/hooks/useSearchSubmit";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import type { RequirementResolution } from "@/lib/api";
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

function replacePlannerInList(planners: Planner[], updated: Planner): Planner[] {
  return planners.map((p) => (p.id === updated.id ? updated : p));
}

function buildAddCourseUndo(
  beforePlanners: Planner[],
  afterPlanner: Planner,
  removeFn: (id: number) => Promise<void>,
): () => Promise<void> {
  const beforeIds = new Set(
    beforePlanners.flatMap((p) => p.plannedCourses.map((pc) => pc.id))
  );
  const addedCourses = afterPlanner.plannedCourses.filter((pc) => !beforeIds.has(pc.id));

  return async () => {
    if (addedCourses.length > 0) {
      await removeFn(addedCourses[0].id);
    }
  };
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
  const scrollYRef = useRef<number | null>(null);
  const loadedYearRef = useRef<number | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const undoRestoredPlannerRef = useRef<Planner | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const { planner: plannerService, completedCourses: completedService, analysis: analysisService, resolutions: resolutionsService } = useServices();
  const router = useRouter();

  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [completedCoursePicker, setCompletedCoursePicker] = useState<{ open: boolean; excludeCourseIds?: number[] }>({ open: false });
  const [plannerAnalysis, setPlannerAnalysis] = useState<PlannerAnalysis | null>(null);
  const [allCatalogCourses, setAllCatalogCourses] = useState<PlannerCourseDetails[]>([]);
  const [resolutions, setResolutions] = useState<RequirementResolution[]>([]);
  const [earlyBirdPending, setEarlyBirdPending] = useState<{
    selection: { courseId: number } | { plannerOptionId: number };
    semester: number;
    slot: number;
    plannerId: number;
  } | null>(null);

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
      const data = await resolutionsService.getResolutions();
      setResolutions(data);
    } catch {
      setResolutions([]);
    }
  }, [resolutionsService]);

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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success", onUndo?: () => void) => {
    setToast({ message, type, onUndo, visible: true });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
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
    }: {
      courseId: number;
      gradeCompleted: GradeCompleted;
    }) => {
      try {
        await completedService.addCompletedCourse(courseId, gradeCompleted);
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
        await resolutionsService.createResolution(data);
        const updated = await resolutionsService.getResolutions();
        setResolutions(updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add resolution";
        showToast(message, "warning");
      }
    },
    [showToast, resolutionsService]
  );

  const handleRemoveResolution = useCallback(async (id: number) => {
    try {
      await resolutionsService.deleteResolution(id);
      setResolutions((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove resolution";
      showToast(message, "warning");
    }
  }, [resolutionsService]);

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

      if ("courseId" in selection) {
        const course = allCatalogCourses.find((c) => c.id === selection.courseId);
        if (course?.supportsEarlyBird) {
          setEarlyBirdPending({
            selection,
            semester: activeSlot.semester,
            slot: activeSlot.slot,
            plannerId: planner.id,
          });
          return;
        }
      }

      const semester = activeSlot.semester;
      const plannedCourse = "courseId" in selection
        ? allCatalogCourses.find((c) => c.id === selection.courseId)
        : null;
      if (plannedCourse && isApScience(plannedCourse)) {
        const existingApScience = allPlanners
          .flatMap((p) => p.plannedCourses)
          .filter((pc) => pc.semester === semester && isApScience(pc.course) && !pc.isEarlyBird);
        if (existingApScience.length > 0) {
          showToast("Two 1.5-period AP science courses may only be taken together if one is scheduled as an Early Bird section.", "warning");
          return;
        }
      }

      try {
        scrollYRef.current = window.scrollY;
        const beforePlanners = allPlanners;
        const updatedPlanner =
          "courseId" in selection
            ? await plannerService.addPlannedCourse(
                planner.id,
                selection.courseId,
                semester,
                activeSlot.slot
              )
            : await plannerService.addPlannedCourse(planner.id, {
                plannerOptionId: selection.plannerOptionId,
                semester,
                slot: activeSlot.slot,
              });
        const newPlanners = replacePlannerInList(beforePlanners, updatedPlanner);
        pushHistory(
          newPlanners,
          buildAddCourseUndo(beforePlanners, updatedPlanner, plannerService.removePlannedCourse)
        );
        handleCloseModal();
        showToast("Course added.", "success", handleUndo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add course";
        showToast(message, "warning");
      }
    },
    [planner, activeSlot, allPlanners, allCatalogCourses, handleCloseModal, pushHistory, showToast, handleUndo, plannerService]
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
          buildAddCourseUndo(beforePlanners, updatedPlanner, plannerService.removePlannedCourse)
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

  const handleReplaceCourse = useCallback(
    async (oldPlanned: PlannedCourse, newCourseId: number) => {
      const beforePlanners = allPlanners;
      try {
        scrollYRef.current = window.scrollY;
        await plannerService.removePlannedCourse(oldPlanned.id);
        const updatedPlanner = await plannerService.addPlannedCourse(
          oldPlanned.plannerId,
          newCourseId,
          oldPlanned.semester,
          oldPlanned.slot
        );
        const newPlanners = replacePlannerInList(beforePlanners, updatedPlanner);
        pushHistory(newPlanners, async () => {
          const added = updatedPlanner.plannedCourses.find((pc) => pc.courseId === newCourseId);
          if (added) {
            await plannerService.removePlannedCourse(added.id);
          }
          if (oldPlanned.courseId != null) {
            await plannerService.addPlannedCourse(
              oldPlanned.plannerId,
              oldPlanned.courseId,
              oldPlanned.semester,
              oldPlanned.slot
            );
          }
        });
        setAllPlanners(newPlanners);
        setPlanner(newPlanners.find((p) => p.schoolYear === year) || null);
        showToast("Course replaced.", "success", handleUndo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to replace course";
        showToast(message, "warning");
      }
    },
    [allPlanners, year, plannerService, showToast, pushHistory, handleUndo]
  );

  const handleMove = useCallback(
    async (plannedCourseId: number, semester: number, slot: number) => {
      scrollYRef.current = window.scrollY;
      const source = allPlanners.flatMap((p) => p.plannedCourses).find((pc) => pc.id === plannedCourseId);
      if (!source) return;
      if (source.semester === semester && source.slot === slot && source.course.duration !== 2) return;
      if (source.course.duration === 2 && source.slot === slot) return;

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
      }
    },
    [allPlanners, pushHistory, showToast, handleUndo, year, plannerService]
  );

  const plannedBySlot = (semester: number, slot: number) =>
    planner?.plannedCourses.find(
      (course) => course.semester === semester && course.slot <= slot && slot < course.slot + (course.slotSpan ?? 1)
    );

  const { isMobile, isTablet } = useBreakpoint();

  const warningsByCourse = useMemo(() => {
    if (!planner) return new Map<number, PlannerWarning[]>();
    const map = new Map<number, PlannerWarning[]>();
    for (const pc of planner.plannedCourses) {
      const warnings = getWarnings(pc, allPlanners, completedCourses, allCatalogCourses, pc.semester, year)
        .filter((w) => !ignoredWarnings.has(makeWarningKey(pc, w)));
      map.set(pc.id, warnings);
    }
    return map;
  }, [planner, allPlanners, completedCourses, allCatalogCourses, ignoredWarnings, year]);

  const handleMobileOpenModal = useCallback((semester: number) => {
    if (!planner) return;
    const occupiedSlots = new Set<number>();
    for (const pc of planner.plannedCourses.filter(pc => pc.semester === semester)) {
      const span = pc.slotSpan ?? 1;
      for (let i = 0; i < span; i++) {
        occupiedSlots.add(pc.slot + i);
      }
    }
    const slot = [1, 2, 3, 4, 5, 6, 7].find(s => !occupiedSlots.has(s)) ?? 7;
    handleOpenModal(semester, slot);
  }, [planner, handleOpenModal]);

  const isCompleted = planner?.completedAt != null;

  const buildSemesterGrid = (semester: number) => {
    const items: React.ReactElement[] = [];
    const renderedCourseIds = new Set<number>();
    let slot = 1;
    while (slot <= 7) {
      const course = plannedBySlot(semester, slot);
      if (course && course.courseId != null && renderedCourseIds.has(course.courseId)) {
        const span = Math.max(course.slotSpan ?? 1, course.course.slotsPerSemester ?? 1);
        slot = Math.max(slot + 1, course.slot + span);
      } else if (course && course.slot === slot && course.semester === semester) {
        const span = Math.max(course.slotSpan ?? 1, course.course.slotsPerSemester ?? 1);
        if (course.courseId != null) renderedCourseIds.add(course.courseId);
        items.push(
          <div
            key={`course-${course.id}`}
            style={{
              gridRow: `${slot} / span ${span}`,
              display: "flex",
              alignItems: "stretch",
            }}
          >
            <PlannedCourseCard
              planned={course}
              isMultiSlot={span > 1}
              warnings={getWarnings(
                course,
                allPlanners,
                completedCourses,
                allCatalogCourses,
                semester,
                year
              ).filter((w) => !ignoredWarnings.has(makeWarningKey(course, w)))}
              isHighlighted={highlightedPlannedCourseId === course.id}
              onRemove={isCompleted ? undefined : () => handleRemoveCourse(course)}
              onClick={() => handleCourseClick(course)}
              onWarningClick={(w) => setSelectedWarning({ planned: course, warning: w })}
            />
          </div>
        );
        slot += span;
      } else {
        if (isCompleted) {
          items.push(
            <div key={`completed-${semester}-${slot}`} style={{ gridRow: `${slot} / span 1`, padding: "20px", minHeight: "120px", backgroundColor: "#1f2937", border: "1px dashed #4b5563", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "#6b7280", fontSize: "14px", textAlign: "center", opacity: 0.6 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>Slot {slot}</div>
              <div>Empty - editing disabled</div>
            </div>
          );
        } else {
          items.push(
            <div key={`empty-${semester}-${slot}`} style={{ gridRow: `${slot} / span 1` }}>
              <AddCourseCard semester={semester} slot={slot} onClick={() => handleOpenModal(semester, slot)} isTablet={isTablet} />
            </div>
          );
        }
        slot++;
      }
    }
    return items;
  };

  const mobileContent = planner && (
    <>
      <style>{`
        .mob-planner-header {
          position: sticky;
          top: calc(56px + var(--safe-area-top, 0px));
          z-index: 40;
          background: var(--bg-page);
          padding: 16px 0 12px;
        }
        .mob-planner-header h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
        }
        .mob-planner-semester h2 {
          margin: 0 0 12px;
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
        }
        .mob-course-card {
          padding: 16px;
          border-radius: 12px;
          border-left: 4px solid;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 80px;
          cursor: pointer;
        }
        .mob-course-card.highlighted {
          box-shadow: 0 0 0 4px rgba(236, 186, 43, 0.6), 0 6px 16px rgba(0,0,0,0.15);
          transform: scale(1.03);
        }
        .mob-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 20px;
          min-height: 60px;
          background: #1f2937;
          border: 2px dashed #4b5563;
          border-radius: 12px;
          cursor: pointer;
          color: #9ca3af;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .mob-add-btn:active {
          border-color: #6b7280;
          color: #d1d5db;
        }
        .mob-fab {
          position: fixed;
          bottom: calc(24px + var(--safe-area-bottom, 0px));
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--brand-accent);
          border: none;
          color: #111827;
          font-size: 28px;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          cursor: pointer;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .mob-fab:active {
          transform: scale(0.95);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .mob-semester-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .mob-summary-toggle {
          width: 100%;
          padding: 14px 16px;
          background: #ffffff;
          border: 2px solid #275D38;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          transition: background 0.15s ease;
        }
        .mob-summary-toggle:active {
          background: #f3f4f6;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="mob-planner-header">
          <h1>{YEAR_LABELS[year] ?? "Year"} Planner</h1>
        </div>

        {isCompleted && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "#dcfce7",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#166534",
            }}
          >
            This year has been marked as completed. Editing is disabled.
          </div>
        )}

        <MobilePlanner
          planner={planner}
          year={year}
          isCompleted={isCompleted}
          warningsByCourse={warningsByCourse}
          highlightedPlannedCourseId={highlightedPlannedCourseId}
          plannerAnalysis={plannerAnalysis}
          resolutions={resolutions}
          allPlanners={allPlanners}
          onOpenModal={handleMobileOpenModal}
          onRemoveCourse={handleRemoveCourse}
          onCourseClick={handleCourseClick}
          onShowWarningAction={(planned, warning) => setSelectedWarning({ planned, warning })}
          onAddResolution={handleAddResolution}
          onRemoveResolution={handleRemoveResolution}
        />
      </div>
    </>
  );

  if (isMobile && planner) {
    return (
      <>
        <ResponsivePage>
          <Link
            href="/planner"
            style={{
              display: "inline-block",
              fontSize: "14px",
              color: "var(--text-secondary)",
              textDecoration: "none",
              fontWeight: 500,
              marginBottom: "12px",
            }}
          >
            ← Back to Planner
          </Link>

          <GuestUpgradePrompt />

          {loading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading planner...</p>
          ) : error ? (
            <p style={{ color: "var(--status-error)" }}>{error}</p>
          ) : !planner ? (
            <p style={{ color: "var(--text-muted)" }}>Planner not found.</p>
          ) : (
            mobileContent
          )}
        </ResponsivePage>

        {activeSlot && planner && !isCompleted && (
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
            plannerAnalysis={plannerAnalysis}
            completedCourses={completedCourses}
            currentYear={year}
            onClose={() => setSelectedWarning(null)}
            onAddToPlanner={handleAddPrerequisiteToPlanner}
            onSwapSemesters={handleMove}
            onReplaceCourse={handleReplaceCourse}
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
              await resolutionsService.createResolution({ type: "middle_school", courseId, metadata: { grade } });
              const completed = await completedService.addCompletedCourse(courseId, grade);
              setCompletedCourses((prev) => [...prev, completed]);
              const data = await resolutionsService.getResolutions();
              setResolutions(data);
            }}
            onSummerSchool={async (courseId, grade) => {
              await resolutionsService.createResolution({ type: "summer_school", courseId, metadata: { grade } });
              const completed = await completedService.addCompletedCourse(courseId, grade);
              setCompletedCourses((prev) => [...prev, completed]);
              const data = await resolutionsService.getResolutions();
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
      </>
    );
  }

  return (
    <div
      style={{
        padding: "32px",
        minHeight: "calc(100dvh - 64px)",
        boxSizing: "border-box",
        overflowX: "hidden",
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

      <GuestUpgradePrompt />

      <div
        style={{
          display: "flex",
          gap: "32px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <h1
            style={{
              margin: "0 0 28px",
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            {YEAR_LABELS[year] ?? "Year"} Planner
          </h1>

          {isCompleted && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: "20px",
                backgroundColor: "#dcfce7",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#166534",
              }}
            >
              This year has been marked as completed. Editing is disabled.
            </div>
          )}

          {loading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading planner...</p>
          ) : error ? (
            <p style={{ color: "var(--status-error)" }}>{error}</p>
          ) : !planner ? (
            <p style={{ color: "var(--text-muted)" }}>Planner not found.</p>
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
                      color: "var(--text-primary)",
                    }}
                  >
                    Semester {semester}
                  </h2>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateRows: `repeat(7, minmax(${isTablet ? 80 : 120}px, auto))`,
                      gap: "12px",
                      flex: 1,
                    }}
                  >
                    {buildSemesterGrid(semester)}
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

      {activeSlot && planner && !isCompleted && (
        <CourseSearchModal
          onClose={handleCloseModal}
          onSelect={handleCourseSelected}
          isSaved={isSaved}
          grade={year}
          allPlanners={allPlanners}
          onGoToCourse={handleGoToCourse}
        />
      )}

      {earlyBirdPending && (() => {
        const course = allCatalogCourses.find((c) =>
          "courseId" in earlyBirdPending.selection
            ? c.id === earlyBirdPending.selection.courseId
            : false
        );
        return (
          <EarlyBirdModal
            courseTitle={course?.title ?? "this course"}
            onSelect={async (isEarlyBird) => {
              const pending = earlyBirdPending;
              setEarlyBirdPending(null);
              if (!planner) return;
              const semester = pending.semester;
              try {
                if (isEarlyBird) {
                  const existingEB = allPlanners
                    .flatMap((p) => p.plannedCourses)
                    .filter((pc) => pc.semester === semester && pc.isEarlyBird);
                  if (existingEB.length > 0) {
                    showToast("You may only take one Early Bird course each semester.", "warning");
                    return;
                  }
                }
                const selCourseId = "courseId" in pending.selection ? pending.selection.courseId : null;
                const plannedCourse = selCourseId != null
                  ? allCatalogCourses.find((c) => c.id === selCourseId)
                  : null;
                if (!isEarlyBird && plannedCourse && isApScience(plannedCourse)) {
                  const existingApScience = allPlanners
                    .flatMap((p) => p.plannedCourses)
                    .filter((pc) => pc.semester === semester && isApScience(pc.course) && !pc.isEarlyBird);
                  if (existingApScience.length > 0) {
                    showToast("Two 1.5-period AP science courses may only be taken together if one is scheduled as an Early Bird section.", "warning");
                    return;
                  }
                }
                const beforePlanners = allPlanners;
                const plannerOptId = "plannerOptionId" in pending.selection ? pending.selection.plannerOptionId : null;
                const updatedPlanner =
                  selCourseId != null
                    ? await plannerService.addPlannedCourse(
                        pending.plannerId,
                        selCourseId,
                        semester,
                        pending.slot
                      )
                    : await plannerService.addPlannedCourse(
                        pending.plannerId,
                        { plannerOptionId: plannerOptId!, semester, slot: pending.slot }
                      );
                if (isEarlyBird && selCourseId != null) {
                  for (const pc of updatedPlanner.plannedCourses) {
                    if (pc.courseId === selCourseId) {
                      pc.isEarlyBird = true;
                    }
                  }
                }
                const newPlanners = replacePlannerInList(beforePlanners, updatedPlanner);
                pushHistory(
                  newPlanners,
                  buildAddCourseUndo(beforePlanners, updatedPlanner, plannerService.removePlannedCourse)
                );
                handleCloseModal();
                showToast("Course added.", "success", handleUndo);
              } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to add course";
                showToast(message, "warning");
              }
            }}
            onClose={() => setEarlyBirdPending(null)}
          />
        );
      })()}

      {selectedWarning && (
        <WarningActionModal
          planned={selectedWarning.planned}
          warning={selectedWarning.warning}
          allPlanners={allPlanners}
          allCatalogCourses={allCatalogCourses}
          plannerAnalysis={plannerAnalysis}
          completedCourses={completedCourses}
          currentYear={year}
          onClose={() => setSelectedWarning(null)}
          onAddToPlanner={handleAddPrerequisiteToPlanner}
          onSwapSemesters={handleMove}
          onReplaceCourse={handleReplaceCourse}
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
            await resolutionsService.createResolution({ type: "middle_school", courseId, metadata: { grade } });
            const completed = await completedService.addCompletedCourse(courseId, grade);
            setCompletedCourses((prev) => [...prev, completed]);
            const data = await resolutionsService.getResolutions();
            setResolutions(data);
          }}
          onSummerSchool={async (courseId, grade) => {
            await resolutionsService.createResolution({ type: "summer_school", courseId, metadata: { grade } });
            const completed = await completedService.addCompletedCourse(courseId, grade);
            setCompletedCourses((prev) => [...prev, completed]);
            const data = await resolutionsService.getResolutions();
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
  const filledSlots = (currentPlanner?.plannedCourses || []).reduce(
    (sum, pc) => sum + (pc.slotSpan ?? 1), 0
  );
  const slotPercentage = totalSlots > 0 ? Math.min(100, (filledSlots / totalSlots) * 100) : 0;

  return (
    <aside
      style={{
        flex: "0 0 320px",
        minWidth: "280px",
        maxWidth: "100%",
        padding: "24px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
      }}
    >
      <h2
        style={{
          margin: "0 0 20px",
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--text-primary)",
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
            backgroundColor: "var(--border-default)",
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
      <span style={{ fontWeight: 400, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function AddCourseCard({
  semester,
  slot,
  onClick,
  isTablet,
}: {
  semester: number;
  slot: number;
  onClick: () => void;
  isTablet?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isTablet ? "4px" : "8px",
        padding: isTablet ? "12px 16px" : "20px",
        minHeight: isTablet ? "auto" : "120px",
        backgroundColor: "#1f2937",
        border: "2px dashed #4b5563",
        borderRadius: "12px",
        cursor: "pointer",
        color: "#9ca3af",
        transition: "all 0.2s ease",
        textAlign: "center",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#6b7280";
        e.currentTarget.style.color = "#d1d5db";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#4b5563";
        e.currentTarget.style.color = "#9ca3af";
        e.currentTarget.style.transform = "translateY(0)";
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
  isHighlighted,
  isMultiSlot,
  onRemove,
  onClick,
  onWarningClick,
}: {
  planned: PlannedCourse;
  warnings: PlannerWarning[];
  isHighlighted: boolean;
  isMultiSlot?: boolean;
  onRemove?: () => void;
  onClick: () => void;
  onWarningClick: (warning: PlannerWarning) => void;
}): React.ReactElement {
  const { course } = planned;
  const accentColor = getDivisionColor(course.division);
  const bgTint = getDivisionBackgroundColor(course.division);
  const visualSpan = Math.max(planned.slotSpan ?? 1, planned.course.slotsPerSemester ?? 1);
  const multiSlot = isMultiSlot ?? visualSpan > 1;
  const slotLabel = multiSlot
    ? `Slots ${planned.slot}-${planned.slot + visualSpan - 1}`
    : `Slot ${planned.slot}`;
  const isReadOnly = onRemove == null;

  return (
    <div
      onClick={() => onClick()}
      style={{
        padding: "16px",
        backgroundColor: bgTint,
        borderTopWidth: "1px",
        borderRightWidth: "1px",
        borderBottomWidth: "1px",
        borderLeftWidth: "4px",
        borderTopStyle: "solid",
        borderRightStyle: "solid",
        borderBottomStyle: "solid",
        borderLeftStyle: "solid",
        borderTopColor: accentColor,
        borderRightColor: accentColor,
        borderBottomColor: accentColor,
        borderLeftColor: accentColor,
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: multiSlot ? "space-evenly" : undefined,
        gap: multiSlot ? "4px" : "8px",
        minHeight: "120px",
        boxSizing: "border-box",
        cursor: isReadOnly ? "default" : "pointer",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        transform: isHighlighted ? "scale(1.03)" : "scale(1)",
        boxShadow: isHighlighted
          ? "0 0 0 4px rgba(236, 186, 43, 0.6), 0 6px 16px rgba(0,0,0,0.15)"
          : "none",
        position: "relative",
        minWidth: 0,
        wordBreak: "break-word",
        overflowWrap: "break-word",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
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
          {slotLabel}
        </div>
        {onRemove && (
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
        )}
      </div>

      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#111827",
          lineHeight: 1.3,
          wordBreak: "break-word",
          overflowWrap: "break-word",
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
        {(planned.course.slotsPerSemester ?? 1) > 1 && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "rgba(0,0,0,0.2)",
              borderRadius: "9999px",
              fontWeight: 600,
            }}
          >
            {planned.course.slotsPerSemester} consecutive periods
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
          {warnings.map((w) => (
            <div
              key={`${w.type}-${w.prerequisite}`}
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
  const { isMobile: mobile } = useBreakpoint();
  const [selectedDivision, setSelectedDivision] = useState("All Divisions");
  const inputRef = useRef<HTMLInputElement>(null);
  const { draft, setDraft, submitted, hasChanged, submit, handleKeyDown, clearAll } = useSearchSubmit();
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

  const searchIndex = useMemo(() => buildCourseSearchIndex(allCourses), [allCourses]);

  const divisions = useMemo(
    () => extractDivisionsFromItems(allCourses, (course) => course.division),
    [allCourses]
  );

  const filteredResults = useMemo(
    () => allCourses.filter(
      (course) =>
        courseMatchesQuery(course, submitted, searchIndex) &&
        courseMatchesDivisionFilter(
          course.division,
          selectedDivision === "All Divisions" ? null : selectedDivision
        )
    ),
    [allCourses, submitted, selectedDivision]
  );

  const sortedResults = useMemo(
    () => [...filteredResults].sort((a, b) => {
      const aSaved = isSaved(a.id) ? 1 : 0;
      const bSaved = isSaved(b.id) ? 1 : 0;
      return bSaved - aSaved;
    }),
    [filteredResults, isSaved]
  );

  const sheetAnimation = mobile ? `@keyframes cs-slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }` : "";

  return (
    <>
      {mobile && <style>{sheetAnimation}</style>}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: mobile ? "flex-end" : "center",
          justifyContent: "center",
          zIndex: 50,
          padding: mobile ? 0 : "24px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "100%",
            maxWidth: mobile ? "100%" : "600px",
            maxHeight: mobile ? "100%" : "80vh",
            height: mobile ? "100%" : "auto",
            backgroundColor: "#1f2937",
            border: mobile ? "none" : "1px solid #374151",
            borderRadius: mobile ? 0 : "16px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: mobile ? "cs-slide-up 0.25s ease-out" : undefined,

          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: mobile ? "calc(72px + var(--safe-area-top, 0px)) 16px 12px" : "24px 24px 16px",
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
                  fontSize: mobile ? "20px" : "22px",
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
                  width: mobile ? "44px" : "36px",
                  height: mobile ? "44px" : "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  color: "#9ca3af",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "8px",
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "stretch" }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by course title..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                style={{
                  flex: 1,
                  height: "44px",
                  padding: draft ? "0 40px 0 16px" : "0 16px",
                  fontSize: "16px",
                  color: "#ffffff",
                  backgroundColor: "#111827",
                  border: "1px solid #4b5563",
                  borderRadius: "9999px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                aria-label="Search courses"
              />
              {draft && (
                <button
                  type="button"
                  onClick={() => { clearAll(); inputRef.current?.focus(); }}
                  aria-label="Clear search"
                  style={{
                    position: "absolute",
                    right: "4px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                    fontSize: "18px",
                    lineHeight: 1,
                    borderRadius: "50%",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!hasChanged}
              aria-label="Search"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                height: "44px",
                padding: "0 20px",
                fontSize: "14px",
                fontWeight: 500,
                color: "#FFFFFF",
                backgroundColor: "var(--brand-accent)",
                border: "none",
                borderRadius: "9999px",
                cursor: !hasChanged ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                opacity: !hasChanged ? 0.5 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              Search
            </button>
          </div>

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
            padding: mobile ? "12px 16px calc(24px + var(--safe-area-bottom, 0px))" : "16px 24px 24px",
          }}
        >
          {loading ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>Loading courses...</p>
          ) : sortedResults.length === 0 ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>
              {(() => {
                const hasQuery = submitted.trim().length > 0;
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
                      {course.slotsPerSemester > 1 && (
                        <span
                          style={{
                            padding: "3px 8px",
                            backgroundColor: "#1f2937",
                            borderRadius: "9999px",
                          }}
                        >
                          {course.slotsPerSemester} consecutive periods
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
  </>
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
  const { isMobile: mobile } = useBreakpoint();
  return (
    <>
      {mobile && <style>{`@keyframes dc-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: mobile ? "flex-end" : "center",
          justifyContent: "center",
          zIndex: 60,
          padding: mobile ? 0 : "24px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "100%",
            maxWidth: mobile ? "100%" : "400px",
            backgroundColor: "#1f2937",
            border: mobile ? "none" : "1px solid #374151",
            borderRadius: mobile ? "16px 16px 0 0" : "16px",
            padding: mobile ? "calc(24px + var(--safe-area-top, 0px)) 24px calc(32px + var(--safe-area-bottom, 0px))" : "24px",
            color: "#ffffff",
            animation: mobile ? "dc-slide-up 0.25s ease-out" : undefined,
            boxSizing: "border-box",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3
            style={{
              margin: "0 0 16px",
              fontSize: mobile ? "20px" : "20px",
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
                minHeight: mobile ? "44px" : "38px",
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
                minHeight: mobile ? "44px" : "38px",
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
    </>
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
  const { isMobile: mobile } = useBreakpoint();
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
            minHeight: mobile ? "44px" : "28px",
            padding: "6px 12px",
            fontSize: mobile ? "15px" : "13px",
            fontWeight: 500,
            color: "#ffffff",
            backgroundColor: "var(--brand-accent)",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            boxSizing: "border-box",
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
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          color: "#9ca3af",
          background: "none",
          border: "none",
          cursor: "pointer",
          borderRadius: "6px",
        }}
      >
        ×
      </button>
    </div>
  );
}

function MobilePlanner({
  planner,
  year,
  isCompleted,
  warningsByCourse,
  highlightedPlannedCourseId,
  plannerAnalysis,
  resolutions,
  allPlanners,
  onOpenModal,
  onRemoveCourse,
  onCourseClick,
  onShowWarningAction,
  onAddResolution,
  onRemoveResolution,
}: {
  planner: Planner;
  year: number;
  isCompleted: boolean;
  warningsByCourse: Map<number, PlannerWarning[]>;
  highlightedPlannedCourseId: number | null;
  plannerAnalysis: PlannerAnalysis | null;
  resolutions: RequirementResolution[];
  allPlanners: Planner[];
  onOpenModal: (semester: number) => void;
  onRemoveCourse: (planned: PlannedCourse) => void;
  onCourseClick: (planned: PlannedCourse) => void;
  onShowWarningAction: (planned: PlannedCourse, warning: PlannerWarning) => void;
  onAddResolution: (data: { type: string; courseId?: number; metadata?: Record<string, unknown> }) => void;
  onRemoveResolution: (id: number) => void;
}): React.ReactElement {
  const [showSummary, setShowSummary] = useState(false);

  const currentPlanner = allPlanners.find((p) => p.schoolYear === year);
  const totalCredits = sumPlannedCredits(allPlanners.flatMap((p) => p.plannedCourses));
  const currentCredits = sumPlannedCredits(currentPlanner?.plannedCourses || []);

  const sortedCourses = useMemo(() => {
    const seenSemCourse = new Set<string>();
    const visible = planner.plannedCourses.filter((pc) => {
      if (pc.courseId != null && (pc.course.slotsPerSemester ?? 1) > 1) {
        const key = `${pc.courseId}:${pc.semester}`;
        if (seenSemCourse.has(key)) return false;
        seenSemCourse.add(key);
      }
      return true;
    });
    const s1 = visible.filter((pc) => pc.semester === 1).sort((a, b) => a.slot - b.slot);
    const s2 = visible.filter((pc) => pc.semester === 2).sort((a, b) => a.slot - b.slot);
    return [s1, s2];
  }, [planner]);

  const renderCourseCard = (planned: PlannedCourse, semesterIdx: number) => {
    const warnings = warningsByCourse.get(planned.id) ?? [];
    const isHighlighted = highlightedPlannedCourseId === planned.id;
    const accentColor = getDivisionColor(planned.course.division);
    const bgTint = getDivisionBackgroundColor(planned.course.division);

    const visualSpan = Math.max(planned.slotSpan ?? 1, planned.course.slotsPerSemester ?? 1);
    const isMultiSlot = visualSpan > 1;
    const slotRange =
      isMultiSlot
        ? `Slots ${planned.slot}-${planned.slot + visualSpan - 1}`
        : `Slot ${planned.slot}`;

    return (
      <div
        key={planned.id}
        className={`mob-course-card ${isHighlighted ? "highlighted" : ""}`}
        style={{
          backgroundColor: bgTint,
          borderLeftColor: accentColor,
          border: isHighlighted ? `2px solid rgba(236, 186, 43, 0.6)` : undefined,
        }}
        onClick={() => onCourseClick(planned)}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
            {slotRange}
          </span>
            {!isCompleted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveCourse(planned);
                }}
                aria-label="Remove course"
                style={{
                  width: "44px",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "#9ca3af",
                  fontSize: "18px",
                  flex: "0 0 auto",
                }}
              >
                🗑
              </button>
            )}
          </div>

        <div style={{ fontSize: "16px", fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>
          {planned.course.title}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
          {planned.course.creditType && (
            <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "9999px", fontWeight: 500 }}>
              {formatCreditType(planned.course.creditType)}
            </span>
          )}
          {planned.course.credits != null && (
            <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "9999px", fontWeight: 600 }}>
              {planned.course.credits} credits
            </span>
          )}
          {planned.course.duration === 2 && (
            <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "9999px", fontWeight: 600 }}>
              Full Year
            </span>
          )}
          {(planned.course.slotsPerSemester ?? 1) > 1 && (
            <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "9999px", fontWeight: 600 }}>
              {planned.course.slotsPerSemester} consecutive periods
            </span>
          )}
        </div>

        {warnings.length > 0 && (
          <div
            style={{
              marginTop: "4px",
              padding: "8px 10px",
              background: "rgba(236, 186, 43, 0.12)",
              border: "1px solid rgba(236, 186, 43, 0.3)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--brand-accent)",
              lineHeight: 1.4,
            }}
          >
            {warnings.map((w) => (
              <div
                key={`${w.type}-${w.prerequisite}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onShowWarningAction(planned, w);
                }}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                ⚠ {w.message}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSemester = (semester: number, semesterIdx: number) => {
    const courses = sortedCourses[semesterIdx];
    return (
      <div key={semester} className="mob-semester-section">
        <div className="mob-planner-semester">
          <h2>Semester {semester}</h2>
        </div>
        {courses.length === 0 ? (
          <p style={{ fontSize: "14px", color: "var(--text-tertiary, #999)", margin: 0, padding: "8px 0" }}>
            No courses planned.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {courses.map((pc) => renderCourseCard(pc, semesterIdx))}
          </div>
        )}
        {!isCompleted && (
          <button
            type="button"
            className="mob-add-btn"
            onClick={() => onOpenModal(semester)}
          >
            + Add Course to Semester {semester}
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {renderSemester(1, 0)}
      {renderSemester(2, 1)}

      <div style={{ marginTop: "16px" }}>
        <button
          type="button"
          className="mob-summary-toggle"
          onClick={() => setShowSummary((s) => !s)}
        >
          <span>Planner Summary</span>
          <span style={{ fontSize: "18px", transition: "transform 0.2s", transform: showSummary ? "rotate(180deg)" : "rotate(0deg)" }}>
            ▼
          </span>
        </button>
        {showSummary && (
          <div style={{ marginTop: "12px" }}>
            <SummarySidebar
              planners={allPlanners}
              currentYear={year}
              resolutions={resolutions}
              plannerAnalysis={plannerAnalysis}
              onAddResolution={onAddResolution}
              onRemoveResolution={onRemoveResolution}
            />
          </div>
        )}
      </div>

      {!isCompleted && (
        <button
          type="button"
          className="mob-fab"
          onClick={() => onOpenModal(1)}
          aria-label="Add course"
        >
          +
        </button>
      )}
    </>
  );
}

type PlannerWarning = {
  message: string;
  type: "missing_prerequisite" | "later_prerequisite" | "multiple_early_bird" | "ap_science_conflict";
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

function isApScience(course: PlannerCourseDetails): boolean {
  return (
    course.creditType === "AP" &&
    course.division?.toLowerCase() === "science" &&
    course.credits != null &&
    course.credits >= 3
  );
}

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

  // Early Bird validation: only one EB course per semester
  if (planned.isEarlyBird) {
    const samePlannerCourses = allPlanners
      .find((p) => p.id === planned.plannerId)
      ?.plannedCourses.filter(
        (pc) => pc.id !== planned.id && pc.semester === currentSemester && pc.isEarlyBird
      );
    if (samePlannerCourses && samePlannerCourses.length > 0) {
      warnings.push({
        message: "You may only take one Early Bird course each semester.",
        type: "multiple_early_bird",
        prerequisite: course.title,
      });
    }
  }

  // AP science load rule: no more than one 1.5-period AP science per semester unless EB
  if (!planned.isEarlyBird && isApScience(course)) {
    const samePlannerCourses = allPlanners
      .find((p) => p.id === planned.plannerId)
      ?.plannedCourses.filter(
        (pc) => pc.id !== planned.id && pc.semester === currentSemester && isApScience(pc.course) && !pc.isEarlyBird
      );
    if (samePlannerCourses && samePlannerCourses.length > 0) {
      warnings.push({
        message: "Two 1.5-period AP science courses may only be taken together if one is scheduled as an Early Bird section.",
        type: "ap_science_conflict",
        prerequisite: course.title,
      });
    }
  }

  return warnings;
}

function canonicalRequirementName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  const ALIASES: Record<string, string> = {
    "english graduation requirement": "English",
    "mathematics graduation requirement": "Mathematics",
    "science graduation requirement": "Science",
    "social studies graduation requirement": "Social Studies",
    "driver education graduation requirement": "Driver Education",
    "elective graduation requirement": "Electives",
    "consumer education": "Economics or Personal Finance",
    "economics or personal finance graduation requirement": "Economics or Personal Finance",
    "health graduation requirement": "Health",
    "physical welfare": "Physical Education",
    "physical welfare graduation requirement and waivers": "Physical Education",
  };
  return ALIASES[normalized] ?? name.trim();
}

function WarningActionModal({
  planned,
  warning,
  allPlanners,
  allCatalogCourses,
  plannerAnalysis,
  completedCourses: completedCoursesProp,
  currentYear,
  onClose,
  onAddToPlanner,
  onSwapSemesters,
  onIgnore,
  onMarkCompleted,
  onPlacementTest,
  onMiddleSchool,
  onSummerSchool,
  onReplaceCourse,
  showToast,
}: {
  planned: PlannedCourse;
  warning: PlannerWarning;
  allPlanners: Planner[];
  allCatalogCourses: PlannerCourseDetails[];
  plannerAnalysis: PlannerAnalysis | null;
  completedCourses: CompletedCourse[];
  currentYear: number;
  onClose: () => void;
  onAddToPlanner: (plannerId: number, courseId: number, semester: number, slot: number) => Promise<void>;
  onSwapSemesters: (plannedCourseId: number, semester: number, slot: number) => Promise<void>;
  onIgnore: () => void;
  onMarkCompleted: (completed: CompletedCourse) => void;
  onPlacementTest: (courseId: number, grade: GradeCompleted) => Promise<void>;
  onMiddleSchool: (courseId: number, grade: GradeCompleted) => Promise<void>;
  onSummerSchool: (courseId: number, grade: GradeCompleted) => Promise<void>;
  onReplaceCourse?: (oldPlanned: PlannedCourse, newCourseId: number) => Promise<void>;
  showToast: (message: string, type?: ToastType, onUndo?: () => void) => void;
}): React.ReactElement {
  const { isMobile: mobile } = useBreakpoint();
  const { completedCourses: modalCompletedService } = useServices();
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [showConfirmIgnore, setShowConfirmIgnore] = useState(false);

  // Progressive disclosure state
  const [step, setStep] = useState<"initial" | "selectYear" | "foundSlot" | "selectReplacement" | "confirmImpact">("initial");
  const [selectedReplacement, setSelectedReplacement] = useState<PlannedCourse | null>(null);

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
            (pc) =>
              pc.semester === semester &&
              pc.slot <= slot &&
              slot < pc.slot + (pc.slotSpan ?? 1)
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
  const middleSchoolCompletedPeriod: GradeCompleted = GRADE_COMPLETED_OPTIONS[0];

  // --- Impact analysis ---
  const computeCourseImpact = useCallback(
    (targetPlanned: PlannedCourse): { affected: string[]; isRecommended: boolean } => {
      const courseCredits = targetPlanned.course.credits ?? 0;
      const fulfills = (targetPlanned.course.fulfillsRequirements ?? []).map(canonicalRequirementName);
      const affected: string[] = [];

      if (plannerAnalysis) {
        for (const req of plannerAnalysis.graduationRequirements) {
          if (req.status !== "satisfied") continue;
          if (!fulfills.includes(req.name)) continue;
          if (req.requiredValue != null && req.earnedValue - courseCredits < req.requiredValue) {
            affected.push(req.name);
          }
        }
      }

      if (plannerAnalysis && selectedYear) {
        const yearReq = plannerAnalysis.yearRequirements.find((yr) => yr.grade === selectedYear);
        if (yearReq) {
          const displayToCanonical: Record<string, string[]> = {
            "Communication Arts": ["English"],
            Mathematics: ["Mathematics"],
            Science: ["Science", "Biology", "Physical Science"],
            "U.S. History": ["U.S. History"],
            Government: ["Government"],
          };
          for (const item of yearReq.items) {
            if (!item.met) continue;
            const canonicalNames = displayToCanonical[item.category] ?? [item.category];
            if (!fulfills.some((f) => canonicalNames.includes(f))) continue;
            if (item.earnedCredits - courseCredits < item.requiredCredits) {
              affected.push(`${yearReq.label} ${item.category}`);
            }
          }
        }
      }

      return { affected, isRecommended: affected.length === 0 };
    },
    [plannerAnalysis, selectedYear]
  );

  // --- Best placement ---
  const bestPlacement = useMemo(() => {
    for (const year of previousYears) {
      const empty = getFirstEmptySlot(year);
      if (empty) return { year, ...empty };
    }
    return null;
  }, [previousYears, getFirstEmptySlot]);

  // --- Courses in selected year for replacement list ---
  const coursesInSelectedYear = useMemo(() => {
    if (!selectedYear || !selectedCourse) return [];
    const planner = allPlanners.find((p) => p.schoolYear === selectedYear);
    if (!planner) return [];
    return [...planner.plannedCourses].filter(
      (pc) =>
        pc.course.duration === selectedCourse.duration &&
        (pc.course.slotsPerSemester ?? 1) === (selectedCourse.slotsPerSemester ?? 1)
    ).sort(
      (a, b) => a.semester - b.semester || a.slot - b.slot
    );
  }, [selectedYear, selectedCourse, allPlanners]);

  // --- Handlers ---
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
      await onMiddleSchool(selectedCourse.id, middleSchoolCompletedPeriod);
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

  const canReplace = useMemo(() => {
    if (matchedCourses.length !== 1) return false;
    const prereq = matchedCourses[0];
    if (!prereq) return false;
    if (prereq.duration !== planned.course.duration) return false;
    if ((prereq.slotsPerSemester ?? 1) !== (planned.course.slotsPerSemester ?? 1)) return false;
    return true;
  }, [matchedCourses, planned]);

  const [showConfirmReplace, setShowConfirmReplace] = useState(false);

  const handleReplaceCourse = async () => {
    if (!onReplaceCourse || !selectedCourse) return;
    setLoading(true);
    try {
      await onReplaceCourse(planned, selectedCourse.id);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to replace course";
      showToast(message, "warning");
    } finally {
      setLoading(false);
      setShowConfirmReplace(false);
    }
  };

  const handleReplaceClick = () => {
    setShowConfirmReplace(true);
  };

  const cancelReplace = () => {
    setShowConfirmReplace(false);
  };

  const handleAddToYearClick = () => {
    setStep("selectYear");
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    const empty = getFirstEmptySlot(year);
    if (empty) {
      setStep("foundSlot");
    } else {
      setStep("selectReplacement");
    }
  };

  const handleFoundSlotCancel = () => {
    setStep("initial");
    setSelectedYear(null);
  };

  const handleReplacementSelect = (course: PlannedCourse) => {
    const { isRecommended } = computeCourseImpact(course);
    setSelectedReplacement(course);
    if (isRecommended) {
      executeReplacement(course);
    } else {
      setStep("confirmImpact");
    }
  };

  const executeReplacement = async (course: PlannedCourse) => {
    if (!onReplaceCourse || !selectedCourse) return;
    setLoading(true);
    try {
      await onReplaceCourse(course, selectedCourse.id);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to replace course";
      showToast(message, "warning");
    } finally {
      setLoading(false);
      setSelectedReplacement(null);
      setStep("initial");
    }
  };

  const handleConfirmImpactReplace = () => {
    if (selectedReplacement) {
      executeReplacement(selectedReplacement);
    }
  };

  const handleImpactCancel = () => {
    setStep("selectReplacement");
    setSelectedReplacement(null);
  };

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

  // Filter existing buttons to show only when not in the middle of the add-to-year flow
  const showResolutionButtons = step === "initial";

  return (
    <>
      {mobile && <style>{`@keyframes wa-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: mobile ? "flex-end" : "center",
          justifyContent: "center",
          zIndex: 50,
          padding: mobile ? 0 : "24px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "100%",
            maxWidth: mobile ? "100%" : "480px",
            maxHeight: mobile ? "100%" : "80vh",
            height: mobile ? "100%" : "auto",
            backgroundColor: "#1f2937",
            border: mobile ? "none" : "1px solid #374151",
            borderRadius: mobile ? 0 : "16px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: mobile ? "wa-slide-up 0.25s ease-out" : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: mobile ? "calc(72px + var(--safe-area-top, 0px)) 16px 12px" : "24px 24px 16px",
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
                  fontSize: mobile ? "20px" : "22px",
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
                  width: mobile ? "44px" : "36px",
                  height: mobile ? "44px" : "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  color: "#9ca3af",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "8px",
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
              padding: mobile ? "16px 16px calc(24px + var(--safe-area-bottom, 0px))" : "24px",
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

                {/* In-course replace section (always visible) */}
                {showConfirmReplace ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", backgroundColor: "#1f2937", borderRadius: "8px" }}>
                    <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
                      Replace course?
                    </p>
                    <div style={{ fontSize: "14px", color: "#d1d5db", lineHeight: 1.5 }}>
                      <div style={{ padding: "8px 12px", backgroundColor: "#374151", borderRadius: "6px", marginBottom: "8px" }}>
                        {planned.course.title}
                      </div>
                      <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "18px" }}>↓</div>
                      <div style={{ padding: "8px 12px", backgroundColor: "var(--brand-accent)", borderRadius: "6px", color: "#ffffff", marginTop: "8px" }}>
                        {selectedCourse?.title ?? "prerequisite"}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", textAlign: "center" }}>
                      This will keep the same semester and remove the current course.
                    </p>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <button type="button" onClick={cancelReplace} disabled={loading} style={{ flex: 1, padding: "12px 16px", fontSize: "15px", fontWeight: 500, color: "#d1d5db", backgroundColor: "#374151", border: "none", borderRadius: "8px", cursor: "pointer" }}>
                        Cancel
                      </button>
                      <button type="button" onClick={handleReplaceCourse} disabled={loading} style={{ flex: 1, padding: "12px 16px", fontSize: "15px", fontWeight: 500, color: "#ffffff", backgroundColor: "var(--brand-accent)", border: "none", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
                        {loading ? "Replacing..." : "Replace Course"}
                      </button>
                    </div>
                  </div>
                ) : (
                  canReplace && (
                    <button
                      type="button"
                      onClick={handleReplaceClick}
                      disabled={loading}
                      style={{
                        padding: "12px 16px",
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "#ffffff",
                        backgroundColor: "var(--brand-accent)",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      Replace with {selectedCourse?.title ?? "prerequisite"}
                    </button>
                  )
                )}

                {/* Progressive disclosure: Add prerequisite to earlier year */}
                {hasPreviousYears && warning.type === "missing_prerequisite" && selectedCourse && (
                  <>
                    {step === "initial" && (
                      <button
                        type="button"
                        onClick={handleAddToYearClick}
                        disabled={loading}
                        style={{
                          padding: "12px 16px",
                          fontSize: "15px",
                          fontWeight: 500,
                          color: "#ffffff",
                          backgroundColor: "var(--brand-accent)",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        Add {selectedCourse.title} to an earlier year
                      </button>
                    )}

                    {step === "selectYear" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {bestPlacement && (
                          <button
                            type="button"
                            onClick={() => handleYearSelect(bestPlacement.year)}
                            disabled={loading}
                            style={{
                              padding: "14px 16px",
                              fontSize: "15px",
                              fontWeight: 600,
                              color: "#ffffff",
                              backgroundColor: "rgba(39, 93, 56, 0.2)",
                              border: "2px solid var(--brand-accent)",
                              borderRadius: "8px",
                              cursor: "pointer",
                              textAlign: "center",
                            }}
                          >
                            Best placement: {YEAR_LABELS[bestPlacement.year]} Year, Semester {bestPlacement.semester} (recommended)
                          </button>
                        )}

                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", textAlign: "center" }}>
                          Or choose another year
                        </p>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {previousYears.map((y) => {
                            const empty = getFirstEmptySlot(y);
                            return (
                              <button
                                key={y}
                                type="button"
                                onClick={() => handleYearSelect(y)}
                                disabled={loading}
                                style={{
                                  flex: 1,
                                  minWidth: "120px",
                                  padding: "12px 16px",
                                  fontSize: "14px",
                                  fontWeight: 500,
                                  color: empty ? "#ffffff" : "#6b7280",
                                  backgroundColor: empty ? "#374151" : "#1f2937",
                                  border: empty ? "1px solid #4b5563" : "1px dashed #4b5563",
                                  borderRadius: "8px",
                                  cursor: empty ? "pointer" : "not-allowed",
                                  textAlign: "center",
                                }}
                              >
                                {YEAR_LABELS[y]}
                                {!empty && <div style={{ fontSize: "11px", color: "#6b7280" }}>No open slots</div>}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => { setStep("initial"); setSelectedYear(null); }}
                          style={{
                            padding: "10px",
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "#9ca3af",
                            backgroundColor: "transparent",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                          }}
                        >
                          ← Back
                        </button>
                      </div>
                    )}

                    {step === "foundSlot" && selectedYear && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", backgroundColor: "#1f2937", borderRadius: "8px" }}>
                        <p style={{ margin: 0, fontSize: "14px", color: "#34d399", fontWeight: 600 }}>
                          ✓ We found an available slot.
                        </p>
                        <p style={{ margin: 0, fontSize: "14px", color: "#d1d5db" }}>
                          Semester: {YEAR_LABELS[selectedYear]} Semester {getFirstEmptySlot(selectedYear)?.semester}
                        </p>
                        <div style={{ display: "flex", gap: "12px" }}>
                          <button
                            type="button"
                            onClick={handleFoundSlotCancel}
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
                          <button
                            type="button"
                            onClick={handleAddPrerequisite}
                            disabled={loading}
                            style={{
                              flex: 1,
                              padding: "12px 16px",
                              fontSize: "15px",
                              fontWeight: 500,
                              color: "#ffffff",
                              backgroundColor: "var(--brand-accent)",
                              border: "none",
                              borderRadius: "8px",
                              cursor: loading ? "not-allowed" : "pointer",
                              opacity: loading ? 0.5 : 1,
                            }}
                          >
                            {loading ? "Adding..." : "Add Course"}
                          </button>
                        </div>
                      </div>
                    )}

                    {step === "selectReplacement" && selectedYear && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <p style={{ margin: 0, fontSize: "14px", color: "#f59e0b", fontWeight: 600 }}>
                          No available planner slot was found.
                        </p>
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                          Select a course to replace
                        </p>

                        {coursesInSelectedYear.length === 0 ? (
                          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                            No courses in this year to replace.
                          </p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {(() => {
                              const grouped: Record<number, PlannedCourse[]> = { 1: [], 2: [] };
                              for (const c of coursesInSelectedYear) {
                                if (grouped[c.semester]) grouped[c.semester].push(c);
                              }
                              return [1, 2].map((sem) =>
                                grouped[sem].length > 0 ? (
                                  <div key={sem}>
                                    <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                                      {YEAR_LABELS[selectedYear]} Semester {sem}
                                    </p>
                                    {grouped[sem].map((c) => {
                                      const { isRecommended, affected } = computeCourseImpact(c);
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => handleReplacementSelect(c)}
                                          disabled={loading}
                                          style={{
                                            width: "100%",
                                            padding: "12px 16px",
                                            fontSize: "14px",
                                            fontWeight: 500,
                                            color: "#ffffff",
                                            backgroundColor: isRecommended ? "rgba(52, 211, 153, 0.1)" : "#1f2937",
                                            border: isRecommended ? "1px solid #34d399" : "1px solid #374151",
                                            borderRadius: "8px",
                                            cursor: "pointer",
                                            textAlign: "left",
                                            marginBottom: "6px",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                          }}
                                        >
                                          <span>{c.course.title}</span>
                                          {isRecommended && (
                                            <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 600, marginLeft: "8px", whiteSpace: "nowrap" }}>
                                              (Recommended)
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : null
                              );
                            })()}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => { setStep("selectYear"); setSelectedReplacement(null); }}
                          style={{
                            padding: "10px",
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "#9ca3af",
                            backgroundColor: "transparent",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                          }}
                        >
                          ← Choose a different year
                        </button>
                      </div>
                    )}

                    {step === "confirmImpact" && selectedReplacement && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", backgroundColor: "#1f2937", borderRadius: "8px" }}>
                        <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f59e0b" }}>
                          Requirement Impact Warning
                        </p>
                        <p style={{ margin: 0, fontSize: "14px", color: "#d1d5db", lineHeight: 1.5 }}>
                          Replacing {selectedReplacement.course.title} will affect:
                        </p>
                        <ul style={{ margin: "4px 0", paddingLeft: "20px", fontSize: "13px", color: "#f59e0b", lineHeight: 1.6 }}>
                          {(() => {
                            const { affected } = computeCourseImpact(selectedReplacement);
                            return affected.map((a) => <li key={a}>{a}</li>);
                          })()}
                        </ul>
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                          You may no longer satisfy these requirements.
                        </p>
                        <div style={{ display: "flex", gap: "12px" }}>
                          <button
                            type="button"
                            onClick={handleImpactCancel}
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
                          <button
                            type="button"
                            onClick={handleConfirmImpactReplace}
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
                              cursor: loading ? "not-allowed" : "pointer",
                              opacity: loading ? 0.5 : 1,
                            }}
                          >
                            {loading ? "Replacing..." : "Replace Course"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {showResolutionButtons && (
                  <>
                    <button
                      type="button"
                      onClick={handleMarkCompleted}
                      disabled={loading || selectedCourse == null}
                      style={{
                        padding: "12px 16px",
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "#ffffff",
                        backgroundColor: selectedCourse ? "var(--brand-accent)" : "var(--brand-primary)",
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
                  </>
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
    </>
  );
}

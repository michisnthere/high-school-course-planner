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
import { sumPlannedCredits, formatCredits, effectiveSlotSpan } from "@/lib/courseCredits";
import { calculatePlannerOccupancy, TOTAL_PLANNER_SLOTS } from "@/lib/plannerOccupancy";
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
  getEligibleCompletedGrades,
  getDefaultCompletedGrade,
} from "@/lib/completedCourses";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";
import type { StudentPlanningData } from "@/lib/studentData";
import { CompletedCoursePicker } from "@/components/planner/CompletedCoursePicker";
import { EarlyBirdModal } from "@/components/planner/EarlyBirdModal";
import { normalizePrerequisite, prerequisiteMatches } from "@/lib/prerequisiteNormalization";
import { computeCourseLoadRequirements } from "@/lib/courseLoadRequirements";
import { CourseLoadRequirements } from "@/components/planner/CourseLoadRequirements";
import { WaiverSection } from "@/components/planner/WaiverSection";
import { getCreditBearingCount, computeAthleticVariantEligibility, computeWaiverEligibility, courseFulfillsDriverEducation, findDriverEdExternalResolution, hasDriverEducationCourse } from "@/lib/plannerWaivers";
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

const SUMMER_SCHOOL_YEARS = new Set([9, 10, 11]);

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
  const [pendingRemoval, setPendingRemoval] = useState<{
    planned: PlannedCourse;
    waiverWarning: string;
  } | null>(null);

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

  const hasDriverEdExternal = useMemo(
    () => findDriverEdExternalResolution(resolutions) != null,
    [resolutions]
  );

  const assertDriverEdExternalConflict = useCallback(
    (course: PlannerCourseDetails | null | undefined): boolean => {
      if (!course || !hasDriverEdExternal) return false;
      if (!courseFulfillsDriverEducation(course)) return false;
      showToast(
        "Driver Education is already marked as completed outside of school. Undo that first to add it to your planner.",
        "warning"
      );
      return true;
    },
    [hasDriverEdExternal, showToast]
  );

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
    console.log("[SET ACTIVE SLOT]", { semester, slot, slotType: typeof slot, source: "handleOpenModal" });
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
      const course = allCatalogCourses.find((c) => c.id === courseId);
      if (assertDriverEdExternalConflict(course)) return;
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
    [allCatalogCourses, assertDriverEdExternalConflict, loadCompletedCourses, showToast, completedService]
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

      const semester = activeSlot.semester;

      if (semester !== 3 && "courseId" in selection) {
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

      const plannedCourse = "courseId" in selection
        ? allCatalogCourses.find((c) => c.id === selection.courseId)
        : null;
      if (assertDriverEdExternalConflict(plannedCourse)) return;
      if (plannedCourse && isApScience(plannedCourse)) {
        const existingApScience = planner.plannedCourses.filter(
          (pc) => pc.semester === semester && isApScience(pc.course) && !pc.isEarlyBird
        );
        if (existingApScience.length > 0) {
          showToast("Two 1.5-period AP science courses may only be taken together if one is scheduled as an Early Bird section.", "warning");
          return;
        }
      }

      try {
        scrollYRef.current = window.scrollY;
        const beforePlanners = allPlanners;
        console.log("[CALLSITE] handleCourseSelected", { semester, slot: activeSlot.slot, activeSlot, selectionType: "courseId" in selection ? "courseId" : "plannerOptionId" });
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
    [planner, activeSlot, allPlanners, allCatalogCourses, handleCloseModal, pushHistory, showToast, handleUndo, plannerService, assertDriverEdExternalConflict]
  );

  const handleAddPrerequisiteToPlanner = useCallback(
    async (plannerId: number, courseId: number, semester: number, slot: number) => {
      console.log(`[TRACE handleAddPrerequisiteToPlanner PARENT] ENTER: plannerId=${plannerId} courseId=${courseId} semester=${semester} slot=${slot} (slotType=${typeof slot})`);
      if (slot < 1 || slot > 7 || semester < 1 || semester > 2) {
        console.error(`[TRACE handleAddPrerequisiteToPlanner PARENT] INVALID SLOT/SEMESTER! semester=${semester} slot=${slot} slotType=${typeof slot}`);
      }
      const targetPlanner = allPlanners.find((p) => p.id === plannerId);
      if (!targetPlanner) return;

      const targetCourse = allCatalogCourses.find((c) => c.id === courseId);
      if (assertDriverEdExternalConflict(targetCourse)) return;

      try {
        scrollYRef.current = window.scrollY;
        const beforePlanners = allPlanners;
        console.log("[CALLSITE] handleAddPrerequisiteToPlanner", { semester, slot, slotSource: "parameter" });
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
    [allPlanners, pushHistory, showToast, handleUndo, year, plannerService, allCatalogCourses, assertDriverEdExternalConflict]
  );

  const handleMoveAndAddPrerequisite = useCallback(
    async (
      plannedCourseId: number,
      newSemester: number,
      newSlot: number,
      prereqCourseId: number,
      prereqSemester: number,
      prereqSlot: number
    ) => {
      console.log(`[TRACE handleMoveAndAddPrerequisite PARENT] ENTER: plannedCourseId=${plannedCourseId} newSemester=${newSemester} newSlot=${newSlot} prereqCourseId=${prereqCourseId} prereqSemester=${prereqSemester} prereqSlot=${prereqSlot}`);
      if (newSlot < 1 || newSlot > 7 || prereqSlot < 1 || prereqSlot > 7) {
        console.error(`[TRACE handleMoveAndAddPrerequisite PARENT] INVALID SLOT! newSlot=${newSlot} prereqSlot=${prereqSlot}`);
      }
      const source = allPlanners.flatMap((p) => p.plannedCourses).find((pc) => pc.id === plannedCourseId);
      if (!source) {
        console.error(`[TRACE handleMoveAndAddPrerequisite PARENT] source not found for plannedCourseId=${plannedCourseId}`);
        return;
      }

      const prereqCourse = allCatalogCourses.find((c) => c.id === prereqCourseId);
      if (assertDriverEdExternalConflict(prereqCourse)) return;

      try {
        scrollYRef.current = window.scrollY;
        const beforePlanners = allPlanners;

        console.log("MOVE REQUEST", { plannedCourseId, semester: newSemester, slot: newSlot });
        const movedPlanner = await plannerService.movePlannedCourse(plannedCourseId, newSemester, newSlot);
        const afterMovePlanners = beforePlanners.map((p) =>
          p.schoolYear === movedPlanner.schoolYear ? movedPlanner : p
        );
        console.log("[CALLSITE] handleMoveAndAddPrerequisite (prereq)", { semester: prereqSemester, slot: prereqSlot, plannedSlot: allPlanners.flatMap(p => p.plannedCourses).find(pc => pc.courseId === prereqCourseId)?.slot });
        const finalPlanner = await plannerService.addPlannedCourse(
          movedPlanner.id,
          prereqCourseId,
          prereqSemester,
          prereqSlot
        );
        const newPlanners = afterMovePlanners.map((p) =>
          p.schoolYear === finalPlanner.schoolYear ? finalPlanner : p
        );

        pushHistory(newPlanners, async () => {
          const added = finalPlanner.plannedCourses.find((pc) => pc.courseId === prereqCourseId);
          if (added) {
            await plannerService.removePlannedCourse(added.id);
          }
          await plannerService.movePlannedCourse(plannedCourseId, source.semester, source.slot);
        });
        setAllPlanners(newPlanners);
        setPlanner(newPlanners.find((p) => p.schoolYear === year) || null);
        showToast("Course moved and prerequisite added.", "success", handleUndo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to adjust schedule";
        showToast(message, "warning");
      }
    },
    [allPlanners, pushHistory, showToast, handleUndo, year, plannerService, allCatalogCourses, assertDriverEdExternalConflict]
  );

  const computeRemovalWaiverWarning = useCallback(
    (planned: PlannedCourse): string | null => {
      const peWaiverResolutions = resolutions.filter(
        (r) => r.type === "pe_waiver" && r.metadata?.year === year
      );
      if (peWaiverResolutions.length === 0) return null;

      const hasMultiSlot = (planned.slotSpan ?? 1) > 1 || planned.course.duration === 2;
      const removedIds = new Set(
        (allPlanners.find((p) => p.id === planned.plannerId)?.plannedCourses ?? [])
          .filter((pc) =>
            hasMultiSlot ? pc.courseId === planned.courseId : pc.id === planned.id
          )
          .map((pc) => pc.id)
      );

      const currentPlanned = allPlanners.find((p) => p.id === planned.plannerId)?.plannedCourses ?? [];
      const simulatedCourses = currentPlanned.filter((pc) => !removedIds.has(pc.id));
      const simulatedCreditBearing = getCreditBearingCount(simulatedCourses);

      for (const res of peWaiverResolutions) {
        const variant = res.metadata?.variant as string | undefined;
        if (variant === "academic") {
          const simEligibility = computeWaiverEligibility(year, simulatedCreditBearing, simulatedCourses);
          if (!simEligibility.academic.eligible) {
            return "Removing this course will make you ineligible for the Academic PE Waiver. The waiver will be revoked if you continue.";
          }
        } else if (variant === "athletic") {
          const athleticVariant = res.metadata?.athleticVariant as string | undefined;
          const sportCount = athleticVariant === "credit" ? "two-or-more" : "one";
          const result = computeAthleticVariantEligibility(sportCount, simulatedCreditBearing);
          if (!result.eligible) {
            return "Removing this course will make you ineligible for the Athletic PE Waiver. The waiver will be revoked if you continue.";
          }
        } else if (variant === "marching-band") {
          if (planned.course.isMarchingBand) {
            return "Removing this course will revoke the Marching Band PE Waiver.";
          }
        }
      }
      return null;
    },
    [allPlanners, resolutions, year]
  );

  const executeRemoval = useCallback(
    async (planned: PlannedCourse, revokePeWaivers: boolean) => {
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

        if (revokePeWaivers) {
          const peWaiverResolutions = resolutions.filter(
            (r) => r.type === "pe_waiver" && r.metadata?.year === year
          );
          for (const res of peWaiverResolutions) {
            try {
              await resolutionsService.deleteResolution(res.id);
            } catch {
              // best-effort revocation
            }
          }
          try {
            const updated = await resolutionsService.getResolutions();
            setResolutions(updated);
          } catch {
            // ignore
          }
        }

        pushHistory(newPlanners, async () => {
          let restoredPlanner: Planner;
          if (planned.courseId != null) {
            console.log("[CALLSITE] undo restore (courseId)", { semester: planned.semester, slot: planned.slot });
            restoredPlanner = await plannerService.addPlannedCourse(
              planned.plannerId,
              planned.courseId,
              planned.semester,
              planned.slot
            );
          } else if (planned.plannerOptionId != null) {
            console.log("[CALLSITE] undo restore (plannerOptionId)", { semester: planned.semester, slot: planned.slot });
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
    [allPlanners, pushHistory, showToast, handleUndo, resolutions, resolutionsService, year]
  );

  const handleConfirmRemoval = useCallback(async () => {
    if (!pendingRemoval) return;
    const { planned, waiverWarning } = pendingRemoval;
    setPendingRemoval(null);
    await executeRemoval(planned, !!waiverWarning);
  }, [pendingRemoval, executeRemoval]);

  const handleCancelRemoval = useCallback(() => {
    setPendingRemoval(null);
  }, []);

  const handleRemoveCourse = useCallback(
    (planned: PlannedCourse) => {
      const waiverWarning = computeRemovalWaiverWarning(planned);
      if (waiverWarning) {
        setPendingRemoval({ planned, waiverWarning });
      } else {
        executeRemoval(planned, false);
      }
    },
    [computeRemovalWaiverWarning, executeRemoval]
  );

  const handleToggleEarlyBird = useCallback(
    async (planned: PlannedCourse, isEarlyBird: boolean) => {
      try {
        scrollYRef.current = window.scrollY;
        const beforePlanners = allPlanners;
        const updatedPlanner = await plannerService.updateEarlyBird(planned.id, isEarlyBird);
        const newPlanners = replacePlannerInList(beforePlanners, updatedPlanner);
        pushHistory(newPlanners, async () => {
          await plannerService.updateEarlyBird(planned.id, !isEarlyBird);
        });
        showToast(
          isEarlyBird ? "Course marked as Early Bird." : "Early Bird removed.",
          "success",
          handleUndo
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update Early Bird";
        showToast(message, "warning");
      }
    },
    [allPlanners, plannerService, showToast, pushHistory, handleUndo]
  );

  const handleReplaceCourse = useCallback(
    async (oldPlanned: PlannedCourse, newCourseId: number) => {
      const beforePlanners = allPlanners;
      try {
        scrollYRef.current = window.scrollY;
        await plannerService.removePlannedCourse(oldPlanned.id);
        console.log("[CALLSITE] handleReplaceCourse (new)", { semester: oldPlanned.semester, slot: oldPlanned.slot, newCourseId });
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
            console.log("[CALLSITE] handleReplaceCourse (undo)", { semester: oldPlanned.semester, slot: oldPlanned.slot });
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
      const warnings = getWarnings(pc, allPlanners, completedCourses, allCatalogCourses, pc.semester, year, resolutions)
        .filter((w) => !ignoredWarnings.has(makeWarningKey(pc, w)));
      map.set(pc.id, warnings);
    }
    return map;
  }, [planner, allPlanners, completedCourses, allCatalogCourses, ignoredWarnings, year, resolutions]);

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
    console.log("[CALLSITE] handleMobileOpenModal", { semester, slot, computedFrom: "first free of [1..7]" });
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
        const span = effectiveSlotSpan(course);
        slot = Math.max(slot + 1, course.slot + span);
      } else if (course && course.slot === slot && course.semester === semester) {
        const span = effectiveSlotSpan(course);
        if (course.courseId != null) renderedCourseIds.add(course.courseId);
        items.push(
          <div
            key={`course-${course.id}`}
            style={{
              gridRow: `${slot} / span ${span}`,
              display: "flex",
              alignItems: "stretch",
              width: "100%",
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
                year,
                resolutions
              ).filter((w) => !ignoredWarnings.has(makeWarningKey(course, w)))}
              isHighlighted={highlightedPlannedCourseId === course.id}
              onRemove={isCompleted ? undefined : () => handleRemoveCourse(course)}
              onToggleEarlyBird={
                isCompleted ? undefined : (isEarlyBird) => handleToggleEarlyBird(course, isEarlyBird)
              }
              onClick={() => handleCourseClick(course)}
              onWarningClick={(w) => setSelectedWarning({ planned: course, warning: w })}
            />
          </div>
        );
        slot += span;
      } else {
        if (isCompleted) {
          items.push(
            <div key={`completed-${semester}-${slot}`} style={{ gridRow: `${slot} / span 1`, width: "100%", boxSizing: "border-box", padding: "20px", minHeight: "120px", backgroundColor: "#1f2937", border: "1px dashed #4b5563", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "#6b7280", fontSize: "14px", textAlign: "center", opacity: 0.6 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>Slot {slot}</div>
              <div>Empty - editing disabled</div>
            </div>
          );
        } else {
          const currentSlot = slot;
          items.push(
            <div key={`empty-${semester}-${currentSlot}`} style={{ gridRow: `${currentSlot} / span 1`, width: "100%" }}>
              <AddCourseCard semester={semester} slot={currentSlot} onClick={() => { console.log("[CALLSITE] buildSemesterGrid AddCourseCard click", { semester, slot: currentSlot }); handleOpenModal(semester, currentSlot); }} isTablet={isTablet} />
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
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              backgroundColor: "#dcfce7",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#166534",
            }}
          >
            <span
              style={{
                padding: "2px 10px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#166534",
                backgroundColor: "#bbf7d0",
                borderRadius: "9999px",
                whiteSpace: "nowrap",
              }}
            >
              ✓ Completed
            </span>
            This planner is in view-only mode.
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
          completedCourses={completedCourses}
          onOpenModal={handleMobileOpenModal}
          onRemoveCourse={handleRemoveCourse}
          onToggleEarlyBird={handleToggleEarlyBird}
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
            targetSemester={activeSlot.semester}
          />
        )}

        {selectedWarning && !isCompleted && (
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
            onMoveAndAddPrerequisite={handleMoveAndAddPrerequisite}
            onIgnore={() =>
              persistIgnoredWarning(makeWarningKey(selectedWarning.planned, selectedWarning.warning))
            }
            onMarkCompleted={(completed) =>
              setCompletedCourses((prev) => [...prev, completed])
            }
            onPlacementTest={async (courseId, prerequisite) => {
              await resolutionsService.createResolution({ type: "placement_test", courseId, metadata: { prerequisite } });
              const data = await resolutionsService.getResolutions();
              setResolutions(data);
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
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                marginBottom: "20px",
                backgroundColor: "#dcfce7",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#166534",
              }}
            >
              <span
                style={{
                  padding: "2px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#166534",
                  backgroundColor: "#bbf7d0",
                  borderRadius: "9999px",
                  whiteSpace: "nowrap",
                }}
              >
                ✓ Completed
              </span>
              This planner is in view-only mode.
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
                      gridTemplateColumns: "minmax(0, 1fr)",
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

          {!isCompleted && SUMMER_SCHOOL_YEARS.has(year) && (
            <div style={{ marginTop: "32px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>
                Summer School
              </h2>
              {(() => {
                const summerCourses = planner?.plannedCourses.filter((pc) => pc.semester === 3) ?? [];
                return summerCourses.length === 0 ? (
                  <p style={{ margin: "0 0 16px", fontSize: "14px", color: "var(--text-secondary)" }}>
                    No Summer School courses added.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                    {summerCourses.map((pc) => {
                      const accentColor = getDivisionColor(pc.course.division);
                      const bgTint = getDivisionBackgroundColor(pc.course.division);
                      return (
                        <div
                          key={pc.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "12px 16px",
                            backgroundColor: bgTint,
                            borderLeft: `4px solid ${accentColor}`,
                            borderRadius: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                            {(() => {
                              const code = pc.course.courseCode;
                              return code ? (
                                <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                  {code}
                                </span>
                              ) : null;
                            })()}
                            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, wordBreak: "break-word" }}>
                              {pc.course.title}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCourse(pc)}
                            style={{
                              width: "28px",
                              height: "28px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "transparent",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              color: "#9ca3af",
                              fontSize: "16px",
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)"; e.currentTarget.style.color = "#ef4444"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                          >
                            🗑
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => handleOpenModal(3, 1)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "10px 20px",
                  minHeight: "44px",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "#9ca3af",
                  backgroundColor: "#1f2937",
                  border: "2px dashed #4b5563",
                  borderRadius: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6b7280"; e.currentTarget.style.color = "#d1d5db"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#4b5563"; e.currentTarget.style.color = "#9ca3af"; }}
              >
                + Add Summer School Course
              </button>
            </div>
          )}
        </div>

        {!loading && planner && (
      <SummarySidebar
        planners={allPlanners}
        currentYear={year}
        resolutions={resolutions}
        plannerAnalysis={plannerAnalysis}
        completedCourses={completedCourses}
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
          targetSemester={activeSlot.semester}
        />
      )}

      {pendingRemoval && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
          onClick={handleCancelRemoval}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: "100%",
              maxWidth: "440px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.24)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 12px", fontSize: "20px", color: "var(--text-primary)" }}>
              Remove Course?
            </h2>
            <p style={{ margin: "0 0 8px", fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Are you sure you want to remove <strong style={{ color: "var(--text-primary)" }}>{pendingRemoval.planned.course.title}</strong> from Semester {pendingRemoval.planned.semester}?
            </p>
            {pendingRemoval.waiverWarning && (
              <p style={{ margin: "0 0 20px", padding: "12px", backgroundColor: "#7c2d12", borderRadius: "8px", fontSize: "14px", color: "#fca5a5", lineHeight: 1.5 }}>
                ⚠ {pendingRemoval.waiverWarning}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                onClick={handleCancelRemoval}
                style={{
                  minHeight: "44px",
                  padding: "8px 16px",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoval}
                style={{
                  minHeight: "44px",
                  padding: "8px 16px",
                  border: "1px solid #991b1b",
                  borderRadius: "8px",
                  backgroundColor: "#991b1b",
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
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
              const currentYearPlanner = allPlanners.find((p) => p.id === pending.plannerId);
              try {
                if (isEarlyBird) {
                  const existingEB =
                    currentYearPlanner?.plannedCourses.filter(
                      (pc) => pc.semester === semester && pc.isEarlyBird
                    ) ?? [];
                  if (existingEB.length > 0) {
                    showToast("You may only take one Early Bird course each semester.", "warning");
                    return;
                  }
                }
                const selCourseId = "courseId" in pending.selection ? pending.selection.courseId : null;
                const plannedCourse = selCourseId != null
                  ? allCatalogCourses.find((c) => c.id === selCourseId)
                  : null;
                if (assertDriverEdExternalConflict(plannedCourse)) return;
                if (!isEarlyBird && plannedCourse && isApScience(plannedCourse)) {
                  const existingApScience =
                    currentYearPlanner?.plannedCourses.filter(
                      (pc) => pc.semester === semester && isApScience(pc.course) && !pc.isEarlyBird
                    ) ?? [];
                  if (existingApScience.length > 0) {
                    showToast("Two 1.5-period AP science courses may only be taken together if one is scheduled as an Early Bird section.", "warning");
                    return;
                  }
                }
                const beforePlanners = allPlanners;
                const plannerOptId = "plannerOptionId" in pending.selection ? pending.selection.plannerOptionId : null;
                console.log("[CALLSITE] EarlyBird handleSelect", { semester, slot: pending.slot, pending });
                const updatedPlanner =
                  selCourseId != null
                    ? await plannerService.addPlannedCourse(
                        pending.plannerId,
                        selCourseId,
                        semester,
                        pending.slot,
                        isEarlyBird
                      )
                    : await plannerService.addPlannedCourse(
                        pending.plannerId,
                        { plannerOptionId: plannerOptId!, semester, slot: pending.slot, isEarlyBird }
                      );
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

      {selectedWarning && !isCompleted && (
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
          onMoveAndAddPrerequisite={handleMoveAndAddPrerequisite}
          onIgnore={() =>
            persistIgnoredWarning(makeWarningKey(selectedWarning.planned, selectedWarning.warning))
          }
          onMarkCompleted={(completed) =>
            setCompletedCourses((prev) => [...prev, completed])
          }
          onPlacementTest={async (courseId, prerequisite) => {
            await resolutionsService.createResolution({ type: "placement_test", courseId, metadata: { prerequisite } });
            const data = await resolutionsService.getResolutions();
            setResolutions(data);
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
  completedCourses,
  onAddResolution,
  onRemoveResolution,
}: {
  planners: Planner[];
  currentYear: number;
  resolutions: RequirementResolution[];
  plannerAnalysis: PlannerAnalysis | null;
  completedCourses: CompletedCourse[];
  onAddResolution: (data: { type: string; courseId?: number; metadata?: Record<string, unknown> }) => void;
  onRemoveResolution: (id: number) => void;
}): React.ReactElement {
  const currentPlanner = planners.find((p) => p.schoolYear === currentYear);
  const allCourses = planners.flatMap((p) => p.plannedCourses);

  const yearCourses = (currentPlanner?.plannedCourses || []).filter((pc) => pc.semester !== 3);
  const totalCredits = sumPlannedCredits(allCourses);
  const currentCredits = sumPlannedCredits(yearCourses);
  const occupancy = currentPlanner ? calculatePlannerOccupancy(currentPlanner) : null;
  const currentCourseCount = occupancy?.plannedCount ?? 0;
  const fullYearCount = occupancy?.fullYearCount ?? 0;
  const semesterCount = occupancy?.semesterCount ?? 0;
  const totalSlots = occupancy?.totalSlots ?? TOTAL_PLANNER_SLOTS;
  const filledSlots = occupancy?.filledSlots ?? 0;
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
        <SummaryRow label="Total Credits" value={formatCredits(currentCredits)} />
        <SummaryRow label="Planned Courses" value={String(currentCourseCount)} />
        <SummaryRow label="Full-Year Courses" value={String(fullYearCount)} />
        <SummaryRow label="Semester Courses" value={String(semesterCount)} />
        <SummaryRow label="Overall Credits" value={formatCredits(totalCredits)} />
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
          .filter((r) => r.type === "pe_waiver" && r.metadata?.year === currentYear)
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

      {currentYear === 10 && (() => {
        const driverEdExternal = findDriverEdExternalResolution(resolutions);
        const driverEdInPlanner = hasDriverEducationCourse(
          planners.flatMap((p) => p.plannedCourses),
          completedCourses
        );
        return (
          <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-default)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              Driver Education
            </h3>
            {driverEdExternal ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ fontSize: "13px", color: "#166534", fontWeight: 600 }}>
                  ✓ Completed outside school
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveResolution(driverEdExternal.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-default)",
                    borderRadius: "6px",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "4px 10px",
                    cursor: "pointer",
                    minHeight: "32px",
                  }}
                >
                  Undo
                </button>
              </div>
            ) : driverEdInPlanner ? (
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                Driver Education is already in your planner, so it will be completed through that course.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onAddResolution({ type: "pe_waiver", metadata: { variant: "driver_ed_external", year: currentYear } })}
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "8px 14px",
                    border: "1px solid #166534",
                    borderRadius: "8px",
                    backgroundColor: "#166534",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Mark completed outside school
                </button>
                <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  If you completed Driver Education at a commercial school or obtained your license before age 18.
                </p>
              </>
            )}
          </div>
        );
      })()}

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
        width: "100%",
        boxSizing: "border-box",
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

function EarlyBirdToggle({
  isEarlyBird,
  onChange,
  height = 28,
}: {
  isEarlyBird: boolean;
  onChange: (isEarlyBird: boolean) => void;
  height?: number;
}): React.ReactElement {
  const thumbSize = Math.max(16, height - 10);

  return (
    <div
      role="group"
      aria-label="Early Bird"
      title="Early Bird class (meets before school)"
      style={{ display: "flex", alignItems: "center", gap: "6px", flex: "0 0 auto" }}
    >
      <span style={{ fontSize: "12px", fontWeight: 700, color: "#9ca3af", whiteSpace: "nowrap" }}>
        🐤 Early Bird
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isEarlyBird}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!isEarlyBird);
        }}
        draggable={false}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isEarlyBird ? "flex-end" : "flex-start",
          width: 48,
          height: `${height}px`,
          padding: 4,
          boxSizing: "border-box",
          borderRadius: 9999,
          backgroundColor: isEarlyBird ? "var(--brand-accent)" : "#ffffff",
          border: isEarlyBird ? "1px solid var(--brand-accent)" : "1px solid #d1d5db",
          cursor: "pointer",
          transition: "background-color 0.15s ease, border-color 0.15s ease",
        }}
      >
        <span
          style={{
            width: thumbSize,
            height: thumbSize,
            borderRadius: 9999,
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
            transition: "transform 0.15s ease",
          }}
        />
      </button>
    </div>
  );
}

function PlannedCourseCard({
  planned,
  warnings,
  isHighlighted,
  isMultiSlot,
  onRemove,
  onToggleEarlyBird,
  onClick,
  onWarningClick,
}: {
  planned: PlannedCourse;
  warnings: PlannerWarning[];
  isHighlighted: boolean;
  isMultiSlot?: boolean;
  onRemove?: () => void;
  onToggleEarlyBird?: (isEarlyBird: boolean) => void;
  onClick: () => void;
  onWarningClick: (warning: PlannerWarning) => void;
}): React.ReactElement {
  const { course } = planned;
  const accentColor = getDivisionColor(course.division);
  const bgTint = getDivisionBackgroundColor(course.division);
  const visualSpan = effectiveSlotSpan(planned);
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
        width: "100%",
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "0 0 auto" }}>
            {course.supportsEarlyBird && onToggleEarlyBird && (
              <EarlyBirdToggle
                isEarlyBird={planned.isEarlyBird}
                height={28}
                onChange={(v) => onToggleEarlyBird(v)}
              />
            )}
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
        {planned.isEarlyBird && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "var(--brand-accent)",
              color: "#111827",
              borderRadius: "9999px",
              fontWeight: 700,
            }}
          >
            🐤 Early Bird
          </span>
        )}
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
            {formatCredits(course.credits)} credits
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

function isRepeatableEligible(course: PlannerCourseDetails): boolean {
  return (
    course.isRepeatable === true &&
    course.duration === 1 &&
    course.department === "Physical Education"
  );
}

function isDuplicateCourse(
  course: PlannerCourseDetails,
  allPlanners: Planner[],
  targetYear: number,
  targetSemester: number
): boolean {
  if (course.id < 0) return false;
  if (isRepeatableEligible(course)) {
    // Repeatable one-semester PE may be taken across semesters, but not twice
    // in the same semester of the same year.
    return allPlanners.some(
      (planner) =>
        planner.schoolYear === targetYear &&
        planner.plannedCourses.some((pc) => pc.courseId === course.id && pc.semester === targetSemester)
    );
  }
  return allPlanners.some((planner) => planner.plannedCourses.some((pc) => pc.courseId === course.id));
}

function CourseSearchModal({
  onClose,
  onSelect,
  isSaved,
  grade,
  allPlanners,
  onGoToCourse,
  targetSemester,
}: {
  onClose: () => void;
  onSelect: (selection: { courseId: number } | { plannerOptionId: number }) => void;
  isSaved: (courseId: number) => boolean;
  grade: number;
  allPlanners: Planner[];
  onGoToCourse: (year: number, plannedCourseId: number) => void;
  targetSemester: number;
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
                const isDuplicate = isDuplicateCourse(course, allPlanners, grade, targetSemester);
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
                          {formatCredits(course.credits)} credits
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
  completedCourses,
  onOpenModal,
  onRemoveCourse,
  onToggleEarlyBird,
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
  completedCourses: CompletedCourse[];
  onOpenModal: (semester: number) => void;
  onRemoveCourse: (planned: PlannedCourse) => void;
  onToggleEarlyBird: (planned: PlannedCourse, isEarlyBird: boolean) => void;
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

    const visualSpan = effectiveSlotSpan(planned);
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
          {planned.isEarlyBird && (
            <span style={{ padding: "3px 8px", background: "var(--brand-accent)", color: "#111827", borderRadius: "9999px", fontWeight: 700 }}>
              🐤 Early Bird
            </span>
          )}
          {planned.course.creditType && (
            <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "9999px", fontWeight: 500 }}>
              {formatCreditType(planned.course.creditType)}
            </span>
          )}
          {planned.course.credits != null && (
            <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "9999px", fontWeight: 600 }}>
              {formatCredits(planned.course.credits)} credits
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

        {!isCompleted && planned.course.supportsEarlyBird && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              minHeight: "44px",
              marginTop: "2px",
            }}
          >
            <EarlyBirdToggle
              isEarlyBird={planned.isEarlyBird}
              height={30}
              onChange={(v) => onToggleEarlyBird(planned, v)}
            />
          </div>
        )}

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

  const summerSchoolCourses = planner.plannedCourses.filter((pc) => pc.semester === 3);

  return (
    <>
      <div style={{ marginBottom: "16px" }}>
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
              completedCourses={completedCourses}
              onAddResolution={onAddResolution}
              onRemoveResolution={onRemoveResolution}
            />
          </div>
        )}
      </div>

      {renderSemester(1, 0)}
      {renderSemester(2, 1)}

      {!isCompleted && SUMMER_SCHOOL_YEARS.has(year) && (
        <div style={{ marginTop: "20px" }}>
          <div className="mob-planner-semester">
            <h2>Summer School</h2>
          </div>
          {summerSchoolCourses.length === 0 ? (
            <p style={{ fontSize: "14px", color: "var(--text-tertiary, #999)", margin: "0 0 12px", padding: "8px 0" }}>
              No Summer School courses added.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
              {summerSchoolCourses.map((pc) => renderCourseCard(pc, 2))}
            </div>
          )}
          <button
            type="button"
            className="mob-add-btn"
            onClick={() => onOpenModal(3)}
          >
            + Add Course to Summer School
          </button>
        </div>
      )}

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
  if (course.supportsEarlyBird) return true;
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
  currentYear: number,
  resolutions: RequirementResolution[] = []
): PlannerWarning[] {
  const warnings: PlannerWarning[] = [];
  const { course } = planned;

  if (!course.prerequisites || course.prerequisites.length === 0) {
    return warnings;
  }

  const completedCourseIds = new Set(completedCourses.map((cc) => cc.courseId));

  const placementTestResolved = new Set<string>();
  for (const resolution of resolutions) {
    if (resolution.type === "placement_test" && resolution.courseId) {
      const prereq = resolution.metadata?.prerequisite as string | undefined;
      if (prereq) {
        placementTestResolved.add(`${resolution.courseId}:${normalizePrerequisite(prereq)}`);
      } else {
        placementTestResolved.add(`${resolution.courseId}:*`);
      }
    }
  }

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

    if (
      placementTestResolved.has(`${plannedCourseId}:${normalizePrerequisite(prereq)}`) ||
      placementTestResolved.has(`${plannedCourseId}:*`)
    ) {
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

const waBtnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "8px",
  minHeight: "44px",
  padding: "8px 16px",
  fontSize: "15px",
  fontWeight: 500,
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
};

const waBtnPrimary: React.CSSProperties = {
  ...waBtnBase,
  color: "#ffffff",
  backgroundColor: "var(--brand-accent)",
};

const waBtnSuccess: React.CSSProperties = {
  ...waBtnBase,
  color: "#ffffff",
  backgroundColor: "#059669",
};

const waBtnSecondary: React.CSSProperties = {
  ...waBtnBase,
  color: "#d1d5db",
  backgroundColor: "#374151",
};

const waBtnDanger: React.CSSProperties = {
  ...waBtnBase,
  color: "#ffffff",
  backgroundColor: "#dc2626",
};

const waBtnOutline: React.CSSProperties = {
  ...waBtnBase,
  color: "#d1d5db",
  backgroundColor: "transparent",
  border: "1px solid #4b5563",
};

const waBtnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "40px",
  padding: "8px 12px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#9ca3af",
  backgroundColor: "transparent",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
};

const waDisabled = (disabled: boolean): React.CSSProperties =>
  disabled ? { cursor: "not-allowed", opacity: 0.5 } : {};

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
  onMoveAndAddPrerequisite,
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
  onPlacementTest: (courseId: number, prerequisite: string) => Promise<void>;
  onMiddleSchool: (courseId: number, grade: GradeCompleted) => Promise<void>;
  onSummerSchool: (courseId: number, grade: GradeCompleted) => Promise<void>;
  onReplaceCourse?: (oldPlanned: PlannedCourse, newCourseId: number) => Promise<void>;
  onMoveAndAddPrerequisite?: (
    plannedCourseId: number,
    newSemester: number,
    newSlot: number,
    prereqCourseId: number,
    prereqSemester: number,
    prereqSlot: number
  ) => Promise<void>;
  showToast: (message: string, type?: ToastType, onUndo?: () => void) => void;
}): React.ReactElement {
  const { isMobile: mobile } = useBreakpoint();
  const { completedCourses: modalCompletedService } = useServices();
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [showConfirmIgnore, setShowConfirmIgnore] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{
    changes: Array<{
      type: "added" | "moved" | "replaced" | "removed";
      courseTitle: string;
      location?: string;
      fromLocation?: string;
      toLocation?: string;
      oldCourseTitle?: string;
    }>;
    execute: () => Promise<void>;
    gradImpact: { type: "none" | "warning"; message: string };
  } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // Progressive disclosure state
  const [step, setStep] = useState<"initial" | "selectYear" | "foundSlot" | "selectReplacement" | "confirmImpact">("initial");
  const [selectedReplacement, setSelectedReplacement] = useState<PlannedCourse | null>(null);
  const [completedGrade, setCompletedGrade] = useState<GradeCompleted>(
    getDefaultCompletedGrade(currentYear)
  );

  const eligibleCompletedGrades = useMemo(
    () => getEligibleCompletedGrades(currentYear),
    [currentYear]
  );

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

  const isSlotOccupied = useCallback(
    (planner: Planner, semester: number, slot: number): boolean => {
      return planner.plannedCourses.some(
        (pc) =>
          pc.semester === semester &&
          pc.slot <= slot &&
          slot < pc.slot + (pc.slotSpan ?? 1)
      );
    },
    []
  );

  const getFirstEmptySlot = useCallback(
    (year: number) => {
      const planner = allPlanners.find((p) => p.schoolYear === year);
      if (!planner) return null;
      for (const semester of [1, 2]) {
        for (const slot of [1, 2, 3, 4, 5, 6, 7]) {
          if (!isSlotOccupied(planner, semester, slot)) return { semester, slot };
        }
      }
      return null;
    },
    [allPlanners, isSlotOccupied]
  );

  const findSlotNear = useCallback(
    (planner: Planner, semester: number, preferSlot: number): number | null => {
      const result = findSlotNearImpl(planner, semester, preferSlot);
      console.log({ function: "findSlotNear", inputSemester: semester, inputSlot: preferSlot, result });
      return result;
    },
    [isSlotOccupied]
  );

  function findSlotNearImpl(planner: Planner, semester: number, preferSlot: number): number | null {
    if (!(findSlotNearImpl as any)._logged) {
      (findSlotNearImpl as any)._logged = true;
      console.log("findSlotNearImpl SOURCE:", findSlotNearImpl.toString());
    }
    if (preferSlot >= 1 && preferSlot <= 7 && !isSlotOccupied(planner, semester, preferSlot)) {
      return preferSlot;
    }
    for (let offset = 1; offset <= 6; offset++) {
      for (const candidate of [preferSlot + offset, preferSlot - offset]) {
        if (candidate < 1 || candidate > 7) continue;
        if (!isSlotOccupied(planner, semester, candidate)) {
          return candidate;
        }
      }
    }
    return null;
  }

  const findBestSlotForYear = useCallback(
    (year: number, preferSlot: number): { semester: number; slot: number } | null => {
      if (!(findBestSlotForYear as any)._logged) {
        (findBestSlotForYear as any)._logged = true;
        console.log("findBestSlotForYear SOURCE:", findBestSlotForYear.toString());
      }
      const planner = allPlanners.find((p) => p.schoolYear === year);
      if (!planner) {
        const result = null;
        console.log({ function: "findBestSlotForYear", inputYear: year, inputSlot: preferSlot, result, reason: "no planner" });
        return result;
      }
      if (preferSlot >= 1 && preferSlot <= 7) {
        for (const semester of [1, 2]) {
          if (!isSlotOccupied(planner, semester, preferSlot)) {
            const result = { semester, slot: preferSlot };
            console.log({ function: "findBestSlotForYear", inputYear: year, inputSlot: preferSlot, result });
            return result;
          }
        }
      }
      for (const semester of [1, 2]) {
        const slot = findSlotNear(planner, semester, preferSlot);
        if (slot != null) {
          const result = { semester, slot };
          console.log({ function: "findBestSlotForYear", inputYear: year, inputSlot: preferSlot, result });
          return result;
        }
      }
      console.log({ function: "findBestSlotForYear", inputYear: year, inputSlot: preferSlot, result: null, reason: "no slot found" });
      return null;
    },
    [allPlanners, isSlotOccupied, findSlotNear]
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
      const slot = findBestSlotForYear(year, planned.slot);
      if (slot) return { year, ...slot };
    }
    return null;
  }, [previousYears, findBestSlotForYear, planned.slot]);

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
    if (courseFulfillsDriverEducation(selectedCourse)) {
      const external = plannerAnalysis?.resolutions
        ? findDriverEdExternalResolution(plannerAnalysis.resolutions)
        : null;
      if (external) {
        showToast(
          "Driver Education is already marked as completed outside of school. Undo that first.",
          "warning"
        );
        return;
      }
    }
    setLoading(true);
    try {
      const completed = await modalCompletedService.addCompletedCourse(selectedCourse.id, completedGrade);
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
    if (planned.courseId == null) return;
    setLoading(true);
    try {
      await onPlacementTest(planned.courseId, warning.prerequisite);
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
    console.log(`[TRACE handleAddPrerequisite] planned.id=${planned.id} planned.slot=${planned.slot} selectedYear=${selectedYear} selectedCourse.id=${selectedCourse.id}`);
    const targetSlot = findBestSlotForYear(selectedYear, planned.slot);
    console.log(`[TRACE handleAddPrerequisite] findBestSlotForYear returned:`, JSON.stringify(targetSlot));
    if (!targetSlot) return;
    const targetPlanner = allPlanners.find((p) => p.schoolYear === selectedYear);
    if (!targetPlanner) return;
    console.log(`[TRACE handleAddPrerequisite] FINAL VALIDATION: semester=${targetSlot.semester} slot=${targetSlot.slot}`);
    if (targetSlot.slot < 1 || targetSlot.slot > 7 || targetSlot.semester < 1 || targetSlot.semester > 2) {
      console.error(`[TRACE handleAddPrerequisite] INVALID SLOT DETECTED! semester=${targetSlot.semester} slot=${targetSlot.slot}`);
      return;
    }
    setLoading(true);
    try {
      console.log(`[TRACE handleAddPrerequisite] CALLING onAddToPlanner: plannerId=${targetPlanner.id} courseId=${selectedCourse.id} semester=${targetSlot.semester} slot=${targetSlot.slot}`);
      await onAddToPlanner(targetPlanner.id, selectedCourse.id, targetSlot.semester, targetSlot.slot);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add prerequisite";
      console.error(`[TRACE handleAddPrerequisite] ERROR: ${message}`);
      showToast(message, "warning");
    } finally {
      setLoading(false);
    }
  };

  function findTempSwapSlot(
    allPlannersArr: Planner[],
    plannerId: number,
    excludeIds: Set<number>,
    excludePositions: Array<{ semester: number; slot: number }>
  ): { semester: number; slot: number } | null {
    const planner = allPlannersArr.find((p) => p.id === plannerId);
    if (!planner) return null;
    for (const semester of [1, 2]) {
      for (let slot = 1; slot <= 7; slot++) {
        if (excludePositions.some((pos) => pos.semester === semester && pos.slot === slot)) continue;
        const occupied = planner.plannedCourses.some(
          (pc) =>
            !excludeIds.has(pc.id) &&
            pc.semester === semester &&
            pc.slot <= slot &&
            slot < pc.slot + (pc.slotSpan ?? 1)
        );
        if (!occupied) return { semester, slot };
      }
    }
    return null;
  }

  const swapTempExcludedPositions = [
    { semester: planned.semester, slot: planned.slot },
    ...(warning.prerequisitePlacement
      ? [{ semester: warning.prerequisitePlacement.semester, slot: warning.prerequisitePlacement.slot }]
      : []),
  ];

  const handleSwapSemesters = async () => {
    const prerequisitePlacement = warning.prerequisitePlacement;
    if (!prerequisitePlacement) return;
    setLoading(true);
    try {
      const temp = findTempSwapSlot(
        allPlanners,
        planned.plannerId,
        new Set([planned.id, prerequisitePlacement.id]),
        swapTempExcludedPositions
      );
      if (!temp) throw new Error("No room to swap semesters.");
      await onSwapSemesters(planned.id, temp.semester, temp.slot);
      await onSwapSemesters(prerequisitePlacement.id, planned.semester, planned.slot);
      await onSwapSemesters(planned.id, prerequisitePlacement.semester, prerequisitePlacement.slot);
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
    const targetSlot = findBestSlotForYear(year, planned.slot);
    if (targetSlot) {
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

  const executeReplacement = (course: PlannedCourse) => {
    if (!onReplaceCourse || !selectedCourse) return;
    const { affected } = computeCourseImpact(course);
    const gradMsg = affected.length > 0
      ? `⚠ Replacing ${course.course.title} affects: ${affected.join(", ")}`
      : "No graduation requirements will be affected.";
    setPendingPlan({
      changes: [
        {
          type: "replaced",
          courseTitle: selectedCourse.title,
          oldCourseTitle: course.course.title,
        },
      ],
      gradImpact: affected.length > 0 ? { type: "warning", message: gradMsg } : { type: "none", message: gradMsg },
      execute: async () => {
        setLoading(true);
        try {
          await onReplaceCourse!(course, selectedCourse.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to replace course";
          showToast(message, "warning");
        } finally {
          setLoading(false);
          setSelectedReplacement(null);
          setStep("initial");
        }
      },
    });
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

  const prereqPlannedCourse = useMemo(() => {
    if (!prerequisitePlacement) return null;
    return (
      allPlanners.flatMap((p) => p.plannedCourses).find((pc) => pc.id === prerequisitePlacement.id) ?? null
    );
  }, [allPlanners, prerequisitePlacement]);

  const canSwapSemesters = useMemo(() => {
    if (warning.type !== "later_prerequisite") return false;
    if (!prerequisitePlacement || !prereqPlannedCourse) return false;
    if (prerequisitePlacement.plannerId !== planned.plannerId) return false;
    if (prerequisitePlacement.semester !== 2 || planned.semester !== 1) return false;
    if (planned.course.duration !== 1 || (planned.course.slotsPerSemester ?? 1) !== 1) return false;
    if (prereqPlannedCourse.course.duration !== 1 || (prereqPlannedCourse.course.slotsPerSemester ?? 1) !== 1) {
      return false;
    }
    return findTempSwapSlot(
      allPlanners,
      planned.plannerId,
      new Set([planned.id, prerequisitePlacement.id]),
      swapTempExcludedPositions
    ) != null;
  }, [warning.type, prerequisitePlacement, prereqPlannedCourse, planned, allPlanners, swapTempExcludedPositions]);

  const hasPlacementTestOption = useMemo(() => {
    const text = warning.prerequisite?.toLowerCase() ?? "";
    return text.includes("placement exam") || text.includes("placement test");
  }, [warning.prerequisite]);

  const [showAdjustConfirm, setShowAdjustConfirm] = useState(false);

  const currentPlanner = useMemo(
    () => allPlanners.find((p) => p.schoolYear === currentYear),
    [allPlanners, currentYear]
  );

  const completedCourseIds = useMemo(
    () => new Set(completedCoursesProp.map((cc) => cc.courseId)),
    [completedCoursesProp]
  );

  const semesterAdjustmentPlan = useMemo(() => {
    if (warning.type !== "missing_prerequisite") return null;
    if (planned.course.duration !== 1) return null;
    if ((planned.course.slotsPerSemester ?? 1) !== 1) return null;
    if (!selectedCourse) return null;
    if (selectedCourse.duration !== 1) return null;
    if ((selectedCourse.slotsPerSemester ?? 1) !== 1) return null;
    if (planned.courseId == null) return null;
    if (!currentPlanner) return null;
    if (completedCourseIds.has(selectedCourse.id)) return null;

    const isAlreadyPlanned = allPlanners.some((p) =>
      p.plannedCourses.some((pc) => pc.courseId === selectedCourse.id)
    );
    if (isAlreadyPlanned) return null;

    const hasOwnMissingPrereqs = (selectedCourse.prerequisites ?? []).some((prereqText) => {
      if (!prereqText.trim()) return false;
      const matched = allCourses.filter((c) => prerequisiteMatches(prereqText, c.title, c.courseCode));
      const matchedIds = matched.map((c) => c.id);
      return !matchedIds.some((id) => completedCourseIds.has(id)) &&
             !allPlanners.some((p) => p.plannedCourses.some((pc) => pc.courseId != null && matchedIds.includes(pc.courseId)));
    });
    if (hasOwnMissingPrereqs) return null;

    const canBeInSemester = (course: PlannerCourseDetails | null, semester: number): boolean => {
      if (!course) return true;
      if (semester === 1 && course.courseCodeS2 != null && course.courseCodeS1 == null) return false;
      if (semester === 2 && course.courseCodeS1 != null && course.courseCodeS2 == null) return false;
      return true;
    };

    console.log(`[TRACE semesterAdjustmentPlan] planned.id=${planned.id} planned.semester=${planned.semester} planned.slot=${planned.slot} (type=${typeof planned.slot}) planned.course.title=${planned.course.title} currentYear=${currentYear}`);

    const prevYears = [9, 10, 11, 12]
      .filter((y) => y < currentYear)
      .sort((a, b) => b - a);

    const findPlannerByYear = (year: number) => allPlanners.find((p) => p.schoolYear === year);

    // Try add-only: current year S1 (only for course A in S2)
    if (planned.semester === 2) {
      if (canBeInSemester(selectedCourse, 1)) {
        const slot = findSlotNear(currentPlanner, 1, planned.slot);
        console.log(`[TRACE semesterAdjustmentPlan] case1 (current yr S2->S1): slot=${slot}`);
        if (slot != null) {
          const result = {
            prereqTitle: selectedCourse.title,
            courseATitle: planned.course.title,
            courseAPlannedId: planned.id,
            courseAPlannerId: planned.plannerId,
            prereqCourseId: selectedCourse.id,
            action: "add_only" as const,
            addPrereq: { plannerId: currentPlanner.id, year: currentYear, semester: 1, slot },
            moveTo: null,
          };
          console.log({ function: "semesterAdjustmentPlan", result });
          return result;
        }
      }
    }

    // Try add-only: previous years, S2 then S1, newest first
    for (const year of prevYears) {
      for (const sem of [2, 1]) {
        if (!canBeInSemester(selectedCourse, sem)) continue;
        const planner = findPlannerByYear(year);
        if (!planner) continue;
        const slot = findSlotNear(planner, sem, planned.slot);
        console.log(`[TRACE semesterAdjustmentPlan] case2 (prev yr Y=${year} S=${sem}): slot=${slot}`);
        if (slot != null) {
          const result = {
            prereqTitle: selectedCourse.title,
            courseATitle: planned.course.title,
            courseAPlannedId: planned.id,
            courseAPlannerId: planned.plannerId,
            prereqCourseId: selectedCourse.id,
            action: "add_only" as const,
            addPrereq: { plannerId: planner.id, year, semester: sem, slot },
            moveTo: null,
          };
          console.log({ function: "semesterAdjustmentPlan", result });
          return result;
        }
      }
    }

    // Try move+add: course A in S1 → S2, prereq in S1
    if (planned.semester === 1) {
      if (canBeInSemester(selectedCourse, 1) && canBeInSemester(planned.course, 2)) {
        const destSlot = findSlotNear(currentPlanner, 2, planned.slot);
        console.log(`[TRACE semesterAdjustmentPlan] case3 (move+add): destSlot=${destSlot} addPrereq.slot=${planned.slot}`);
        if (destSlot != null) {
          const result = {
            prereqTitle: selectedCourse.title,
            courseATitle: planned.course.title,
            courseAPlannedId: planned.id,
            courseAPlannerId: planned.plannerId,
            prereqCourseId: selectedCourse.id,
            action: "move_and_add" as const,
            addPrereq: { plannerId: currentPlanner.id, year: currentYear, semester: 1, slot: planned.slot },
            moveTo: { semester: 2, slot: destSlot },
          };
          console.log({ function: "semesterAdjustmentPlan", result });
          return result;
        }
      }
    }

    // No slot found — flag for replacement
    const fallback = {
      prereqTitle: selectedCourse.title,
      courseATitle: planned.course.title,
      courseAPlannedId: planned.id,
      courseAPlannerId: planned.plannerId,
      prereqCourseId: selectedCourse.id,
      action: "replacement" as const,
      addPrereq: null,
      moveTo: null,
    };
    console.log({ function: "semesterAdjustmentPlan", result: fallback });
    return fallback;
  }, [warning, planned, selectedCourse, currentPlanner, allPlanners, completedCourseIds, allCourses, currentYear, findSlotNear]);

  const validateSlot = (semester: number, slot: number): boolean => slot >= 1 && slot <= 7 && semester >= 1 && semester <= 2;

  const handleMoveAndAddPrerequisite = async () => {
    if (!semesterAdjustmentPlan || !selectedCourse) return;

    const preq = semesterAdjustmentPlan.addPrereq;
    console.log(`[TRACE handleMoveAndAddPrerequisite] action=${semesterAdjustmentPlan.action} prereq.semester=${preq?.semester} prereq.slot=${preq?.slot} moveTo.semester=${semesterAdjustmentPlan.moveTo?.semester} moveTo.slot=${semesterAdjustmentPlan.moveTo?.slot}`);
    console.log(`[TRACE handleMoveAndAddPrerequisite] planned.id=${planned.id} planned.slot=${planned.slot} planned.semester=${planned.semester}`);
    if (preq && !validateSlot(preq.semester, preq.slot)) {
      console.error(`[TRACE handleMoveAndAddPrerequisite] INVALID prereq slot! semester=${preq.semester} slot=${preq.slot}`);
      return;
    }
    if (semesterAdjustmentPlan.moveTo && !validateSlot(semesterAdjustmentPlan.moveTo.semester, semesterAdjustmentPlan.moveTo.slot)) {
      console.error(`[TRACE handleMoveAndAddPrerequisite] INVALID moveTo slot! semester=${semesterAdjustmentPlan.moveTo.semester} slot=${semesterAdjustmentPlan.moveTo.slot}`);
      return;
    }

    if (semesterAdjustmentPlan.action === "move_and_add" && semesterAdjustmentPlan.moveTo && onMoveAndAddPrerequisite) {
      const changes = [
        {
          type: "moved" as const,
          courseTitle: semesterAdjustmentPlan.courseATitle,
          fromLocation: `${YEAR_LABELS[currentYear]} Semester 1`,
          toLocation: `${YEAR_LABELS[currentYear]} Semester ${semesterAdjustmentPlan.moveTo.semester}`,
        },
        {
          type: "added" as const,
          courseTitle: semesterAdjustmentPlan.prereqTitle,
          location: `${YEAR_LABELS[currentYear]} • Semester ${semesterAdjustmentPlan.addPrereq!.semester} • Slot ${semesterAdjustmentPlan.addPrereq!.slot}`,
        },
      ];
      setPendingPlan({
        changes,
        gradImpact: { type: "none", message: "No graduation requirements will be affected." },
        execute: async () => {
          await onMoveAndAddPrerequisite(
            planned.id,
            semesterAdjustmentPlan.moveTo!.semester,
            semesterAdjustmentPlan.moveTo!.slot,
            selectedCourse.id,
            semesterAdjustmentPlan.addPrereq!.semester,
            semesterAdjustmentPlan.addPrereq!.slot
          );
        },
      });
    } else if (semesterAdjustmentPlan.action === "add_only" && semesterAdjustmentPlan.addPrereq) {
      const targetPlanner = allPlanners.find((p) => p.id === semesterAdjustmentPlan.addPrereq!.plannerId);
      if (!targetPlanner) return;
      const yr = semesterAdjustmentPlan.addPrereq.year;
      const changes = [
        {
          type: "added" as const,
          courseTitle: semesterAdjustmentPlan.prereqTitle,
          location: `${YEAR_LABELS[yr]} • Semester ${semesterAdjustmentPlan.addPrereq.semester} • Slot ${semesterAdjustmentPlan.addPrereq.slot}`,
        },
      ];
      setPendingPlan({
        changes,
        gradImpact: { type: "none", message: "No graduation requirements will be affected." },
        execute: async () => {
          await onAddToPlanner(
            targetPlanner.id,
            selectedCourse.id,
            semesterAdjustmentPlan.addPrereq!.semester,
            semesterAdjustmentPlan.addPrereq!.slot
          );
        },
      });
    }
    setShowAdjustConfirm(false);
  };

  const handleAdjustmentReplace = useCallback(
    (year: number) => {
      setSelectedYear(year);
      const targetSlot = findBestSlotForYear(year, planned.slot);
      if (targetSlot) {
        setStep("foundSlot");
      } else {
        setStep("selectReplacement");
      }
    },
    [findBestSlotForYear, planned.slot]
  );

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

                {hasPlacementTestOption && (
                  <button
                    type="button"
                    onClick={handlePlacementTest}
                    disabled={loading}
                    style={{
                      ...waBtnSuccess,
                      ...waDisabled(loading),
                    }}
                  >
                    {loading ? "Recording..." : "Mark Placement Test Completed"}
                  </button>
                )}

                {/* In-course replace confirmation */}
                {showConfirmReplace && (
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
                      <button type="button" onClick={cancelReplace} disabled={loading} style={{ ...waBtnSecondary, flex: 1, ...waDisabled(loading) }}>
                        Cancel
                      </button>
                      <button type="button" onClick={handleReplaceCourse} disabled={loading} style={{ ...waBtnPrimary, flex: 1, ...waDisabled(loading) }}>
                        {loading ? "Replacing..." : "Replace Course"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Progressive disclosure: Add prerequisite to earlier year */}
                {hasPreviousYears && warning.type === "missing_prerequisite" && selectedCourse && step !== "initial" && (
                  <>

                    {step === "selectYear" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {bestPlacement && (
                          <button
                            type="button"
                            onClick={() => handleYearSelect(bestPlacement.year)}
                            disabled={loading}
                            style={{
                              ...waBtnBase,
                              color: "#ffffff",
                              backgroundColor: "rgba(39, 93, 56, 0.2)",
                              border: "2px solid var(--brand-accent)",
                              ...waDisabled(loading),
                            }}
                          >
                            Best placement: {YEAR_LABELS[bestPlacement.year]} Year, Semester {bestPlacement.semester} Slot {bestPlacement.slot} (recommended)
                          </button>
                        )}

                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", textAlign: "center" }}>
                          Or choose another year
                        </p>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {previousYears.map((y) => {
                            const slot = findBestSlotForYear(y, planned.slot);
                            return (
                              <button
                                key={y}
                                type="button"
                                onClick={() => handleYearSelect(y)}
                                disabled={loading}
                                style={{
                                  flex: 1,
                                  minWidth: "120px",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "2px",
                                  minHeight: "44px",
                                  padding: "8px 16px",
                                  fontSize: "15px",
                                  fontWeight: 500,
                                  color: slot ? "#ffffff" : "#6b7280",
                                  backgroundColor: slot ? "#374151" : "#1f2937",
                                  border: slot ? "1px solid #4b5563" : "1px dashed #4b5563",
                                  borderRadius: "8px",
                                  cursor: slot ? "pointer" : "not-allowed",
                                  textAlign: "center",
                                  opacity: slot ? 1 : 0.5,
                                }}
                              >
                                {YEAR_LABELS[y]}
                                {slot
                                  ? <div style={{ fontSize: "11px", color: "#9ca3af" }}>S{slot.semester} Slot {slot.slot}</div>
                                  : <div style={{ fontSize: "11px", color: "#6b7280" }}>No open slots</div>}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => { setStep("initial"); setSelectedYear(null); }}
                          style={waBtnGhost}
                        >
                          ← Back
                        </button>
                      </div>
                    )}

                    {step === "foundSlot" && selectedYear && (() => {
                      const foundSlot = findBestSlotForYear(selectedYear, planned.slot);
                      if (!foundSlot) return null;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", backgroundColor: "#1f2937", borderRadius: "8px" }}>
                          <p style={{ margin: 0, fontSize: "14px", color: "#34d399", fontWeight: 600 }}>
                            ✓ Found an available slot.
                          </p>
                          <p style={{ margin: 0, fontSize: "14px", color: "#d1d5db" }}>
                            {YEAR_LABELS[selectedYear]} Year Semester {foundSlot.semester} Slot {foundSlot.slot}
                          </p>
                          <div style={{ display: "flex", gap: "12px" }}>
                            <button
                              type="button"
                              onClick={handleFoundSlotCancel}
                              disabled={loading}
                              style={{
                                ...waBtnSecondary,
                                flex: 1,
                                ...waDisabled(loading),
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleAddPrerequisite}
                              disabled={loading}
                              style={{
                                ...waBtnPrimary,
                                flex: 1,
                                ...waDisabled(loading),
                              }}
                            >
                              {loading ? "Adding..." : "Add Course"}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

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
                                            minHeight: "44px",
                                            padding: "8px 16px",
                                            fontSize: "15px",
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
                                            ...waDisabled(loading),
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
                          style={waBtnGhost}
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
                              ...waBtnSecondary,
                              flex: 1,
                              ...waDisabled(loading),
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmImpactReplace}
                            disabled={loading}
                            style={{
                              ...waBtnDanger,
                              flex: 1,
                              ...waDisabled(loading),
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
                    {/* Section 1: Add to Planner */}
                    <div
                      style={{
                        padding: "12px",
                        backgroundColor: "rgba(236, 186, 43, 0.08)",
                        border: "1px solid rgba(236, 186, 43, 0.25)",
                        borderRadius: "8px",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 12px",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--brand-accent)",
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                        }}
                      >
                        Add to Planner
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {canReplace && !showConfirmReplace && (
                          <button
                            type="button"
                            onClick={handleReplaceClick}
                            disabled={loading}
                            style={{
                              ...waBtnPrimary,
                              ...waDisabled(loading),
                            }}
                          >
                            Replace {planned.course.title} with {selectedCourse?.title ?? "prerequisite"}
                          </button>
                        )}

                        {hasPreviousYears && warning.type === "missing_prerequisite" && selectedCourse && (
                          <button
                            type="button"
                            onClick={handleAddToYearClick}
                            disabled={loading}
                            style={{
                              ...waBtnPrimary,
                              ...waDisabled(loading),
                            }}
                          >
                            Add {selectedCourse.title} to a previous year
                          </button>
                        )}

                        {semesterAdjustmentPlan && !showAdjustConfirm && semesterAdjustmentPlan.action !== "replacement" && (
                          <button
                            type="button"
                            onClick={() => setShowAdjustConfirm(true)}
                            disabled={loading}
                            style={{
                              ...waBtnPrimary,
                              ...waDisabled(loading),
                            }}
                          >
                            {semesterAdjustmentPlan.action === "add_only"
                              ? `Add ${semesterAdjustmentPlan.prereqTitle} to ${YEAR_LABELS[semesterAdjustmentPlan.addPrereq!.year]} Year Semester ${semesterAdjustmentPlan.addPrereq!.semester} Slot ${semesterAdjustmentPlan.addPrereq!.slot}`
                              : `Move ${semesterAdjustmentPlan.courseATitle} to Semester 2 and add ${semesterAdjustmentPlan.prereqTitle} to Semester 1 Slot ${semesterAdjustmentPlan.addPrereq!.slot}`}
                          </button>
                        )}

                        {semesterAdjustmentPlan && semesterAdjustmentPlan.action === "replacement" && !showAdjustConfirm && hasPreviousYears && (
                          <button
                            type="button"
                            onClick={() => handleAdjustmentReplace(currentYear)}
                            disabled={loading}
                            style={{
                              ...waBtnPrimary,
                              ...waDisabled(loading),
                            }}
                          >
                            Move {semesterAdjustmentPlan.courseATitle} to Semester 2 and add {semesterAdjustmentPlan.prereqTitle}
                          </button>
                        )}

                        {canSwapSemesters && (
                          <button
                            type="button"
                            onClick={handleSwapSemesters}
                            disabled={loading}
                            style={{
                              ...waBtnPrimary,
                              ...waDisabled(loading),
                            }}
                          >
                            Swap semesters
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Mark as Previously Completed */}
                    <div
                      style={{
                        padding: "12px",
                        backgroundColor: "rgba(52, 211, 153, 0.08)",
                        border: "1px solid rgba(52, 211, 153, 0.25)",
                        borderRadius: "8px",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 12px",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#34d399",
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                        }}
                      >
                        Mark as Previously Completed
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <label
                            htmlFor="completed-grade-select"
                            style={{
                              fontSize: "13px",
                              color: "#9ca3af",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Completed in:
                          </label>
                          <select
                            id="completed-grade-select"
                            value={completedGrade}
                            onChange={(e) => setCompletedGrade(e.target.value as GradeCompleted)}
                            style={{
                              flex: 1,
                              padding: "6px 8px",
                              fontSize: "13px",
                              color: "#d1d5db",
                              backgroundColor: "#1f2937",
                              border: "1px solid #374151",
                              borderRadius: "4px",
                            }}
                          >
                            {eligibleCompletedGrades.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={handleMarkCompleted}
                          disabled={loading || selectedCourse == null}
                          style={{
                            ...waBtnSuccess,
                            ...waDisabled(loading || selectedCourse == null),
                          }}
                        >
                          Mark {selectedCourse?.title ?? "this course"} as previously completed
                        </button>
                      </div>
                    </div>

                    {semesterAdjustmentPlan && showAdjustConfirm && semesterAdjustmentPlan.action !== "replacement" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", backgroundColor: "#1f2937", borderRadius: "8px" }}>
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", lineHeight: 1.4, fontStyle: "italic" }}>
                          This will automatically reorganize your schedule to satisfy the prerequisite while making the fewest possible changes.
                        </p>
                        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
                          {(() => {
                            const plan = semesterAdjustmentPlan;
                            if (plan.action === "add_only" && plan.addPrereq) {
                              const tPlanner = allPlanners.find((p) => p.id === plan.addPrereq!.plannerId);
                              const beforeCourses = tPlanner
                                ? tPlanner.plannedCourses
                                    .filter((pc) => pc.semester === plan.addPrereq!.semester && pc.courseId != null)
                                    .map((pc) => ({ id: pc.id, title: pc.course.title, slot: pc.slot }))
                                    .sort((a, b) => a.slot - b.slot)
                                : [];
                              const yr = plan.addPrereq.year;
                              return (
                                <>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", textAlign: "center" }}>
                                      Before
                                    </p>
                                    <div style={{ padding: "8px", backgroundColor: "#111827", borderRadius: "6px", minHeight: "60px" }}>
                                      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 600, color: "#9ca3af" }}>
                                        {YEAR_LABELS[yr]} S{plan.addPrereq.semester}
                                      </p>
                                      {beforeCourses.length === 0 ? (
                                        <p style={{ margin: 0, fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>No courses</p>
                                      ) : (
                                        beforeCourses.map((c) => (
                                          <div key={c.id} style={{ padding: "4px 8px", marginBottom: "4px", backgroundColor: "#374151", borderRadius: "4px", fontSize: "12px", color: "#d1d5db" }}>
                                            Slot {c.slot}: {c.title}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", color: "#6b7280", fontSize: "20px" }}>→</div>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", textAlign: "center" }}>
                                      After
                                    </p>
                                    <div style={{ padding: "8px", backgroundColor: "#111827", borderRadius: "6px", minHeight: "60px" }}>
                                      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 600, color: "#9ca3af" }}>
                                        {YEAR_LABELS[yr]} S{plan.addPrereq.semester}
                                      </p>
                                      {beforeCourses.map((c) => (
                                        <div key={c.id} style={{ padding: "4px 8px", marginBottom: "4px", backgroundColor: "#374151", borderRadius: "4px", fontSize: "12px", color: "#d1d5db" }}>
                                          Slot {c.slot}: {c.title}
                                        </div>
                                      ))}
                                      <div style={{ padding: "4px 8px", backgroundColor: "rgba(52, 211, 153, 0.15)", border: "1px solid #34d399", borderRadius: "4px", fontSize: "12px", color: "#34d399", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>Slot {plan.addPrereq.slot}: {plan.prereqTitle}</span>
                                        <span style={{ fontSize: "10px", padding: "1px 6px", backgroundColor: "#34d399", color: "#111827", borderRadius: "4px", fontWeight: 600 }}>New</span>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            }
                            if (plan.action === "move_and_add") {
                              const s1Before = currentPlanner?.plannedCourses
                                .filter((pc) => pc.semester === 1 && pc.courseId != null)
                                .map((pc) => ({ id: pc.id, title: pc.course.title, slot: pc.slot }))
                                .sort((a, b) => a.slot - b.slot) ?? [];
                              const s2Before = currentPlanner?.plannedCourses
                                .filter((pc) => pc.semester === 2 && pc.courseId != null)
                                .map((pc) => ({ id: pc.id, title: pc.course.title, slot: pc.slot }))
                                .sort((a, b) => a.slot - b.slot) ?? [];
                              const courseAEntry = s1Before.find((c) => c.id === plan.courseAPlannedId);
                              const courseAInS2 = courseAEntry
                                ? [{ ...courseAEntry, slot: plan.moveTo!.slot }]
                                : [];
                              return (
                                <>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", textAlign: "center" }}>
                                      Before
                                    </p>
                                    <div style={{ padding: "8px", backgroundColor: "#111827", borderRadius: "6px", minHeight: "60px" }}>
                                      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 600, color: "#9ca3af" }}>
                                        S1
                                      </p>
                                      {s1Before.map((c) => (
                                        <div key={c.id} style={{ padding: "4px 8px", marginBottom: "4px", backgroundColor: c.id === plan.courseAPlannedId ? "rgba(251, 191, 36, 0.15)" : "#374151", border: c.id === plan.courseAPlannedId ? "1px solid #fbbf24" : "none", borderRadius: "4px", fontSize: "12px", color: "#d1d5db" }}>
                                          Slot {c.slot}: {c.title}
                                          {c.id === plan.courseAPlannedId && <span style={{ marginLeft: "6px", fontSize: "10px", color: "#fbbf24" }}>(will move)</span>}
                                        </div>
                                      ))}
                                      <p style={{ margin: "12px 0 6px", fontSize: "11px", fontWeight: 600, color: "#9ca3af" }}>
                                        S2
                                      </p>
                                      {s2Before.map((c) => (
                                        <div key={c.id} style={{ padding: "4px 8px", marginBottom: "4px", backgroundColor: "#374151", borderRadius: "4px", fontSize: "12px", color: "#d1d5db" }}>
                                          Slot {c.slot}: {c.title}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", color: "#6b7280", fontSize: "20px" }}>→</div>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", textAlign: "center" }}>
                                      After
                                    </p>
                                    <div style={{ padding: "8px", backgroundColor: "#111827", borderRadius: "6px", minHeight: "60px" }}>
                                      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 600, color: "#9ca3af" }}>
                                        S1
                                      </p>
                                      {s1Before.filter((c) => c.id !== plan.courseAPlannedId).map((c) => (
                                        <div key={c.id} style={{ padding: "4px 8px", marginBottom: "4px", backgroundColor: "#374151", borderRadius: "4px", fontSize: "12px", color: "#d1d5db" }}>
                                          Slot {c.slot}: {c.title}
                                        </div>
                                      ))}
                                      <div style={{ padding: "4px 8px", marginBottom: "4px", backgroundColor: "rgba(52, 211, 153, 0.15)", border: "1px solid #34d399", borderRadius: "4px", fontSize: "12px", color: "#34d399", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>Slot {plan.addPrereq!.slot}: {plan.prereqTitle}</span>
                                        <span style={{ fontSize: "10px", padding: "1px 6px", backgroundColor: "#34d399", color: "#111827", borderRadius: "4px", fontWeight: 600 }}>New</span>
                                      </div>
                                      <p style={{ margin: "12px 0 6px", fontSize: "11px", fontWeight: 600, color: "#9ca3af" }}>
                                        S2
                                      </p>
                                      {s2Before.map((c) => (
                                        <div key={c.id} style={{ padding: "4px 8px", marginBottom: "4px", backgroundColor: "#374151", borderRadius: "4px", fontSize: "12px", color: "#d1d5db" }}>
                                          Slot {c.slot}: {c.title}
                                        </div>
                                      ))}
                                      <div style={{ padding: "4px 8px", backgroundColor: "rgba(251, 191, 36, 0.15)", border: "1px solid #fbbf24", borderRadius: "4px", fontSize: "12px", color: "#fbbf24", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>Slot {plan.moveTo!.slot}: {plan.courseATitle}</span>
                                        <span style={{ fontSize: "10px", padding: "1px 6px", backgroundColor: "#fbbf24", color: "#111827", borderRadius: "4px", fontWeight: 600 }}>Moved</span>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div style={{ display: "flex", gap: "12px" }}>
                          <button
                            type="button"
                            onClick={() => setShowAdjustConfirm(false)}
                            disabled={loading}
                            style={{
                              ...waBtnSecondary,
                              flex: 1,
                              ...waDisabled(loading),
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleMoveAndAddPrerequisite}
                            disabled={loading}
                            style={{
                              ...waBtnPrimary,
                              flex: 1,
                              ...waDisabled(loading),
                            }}
                          >
                            {loading ? "Applying..." : "Apply"}
                          </button>
                        </div>
                      </div>
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
                    ...waBtnOutline,
                    width: "100%",
                    ...waDisabled(loading),
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
                        ...waBtnDanger,
                        flex: 1,
                        ...waDisabled(loading),
                      }}
                    >
                      Yes, ignore
                    </button>
                    <button
                      type="button"
                      onClick={cancelIgnore}
                      disabled={loading}
                      style={{
                        ...waBtnSecondary,
                        flex: 1,
                        ...waDisabled(loading),
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

      {pendingPlan && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: mobile ? 0 : "24px",
          }}
          onClick={() => { setPendingPlan(null); setAcknowledged(false); }}
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === "Escape") { setPendingPlan(null); setAcknowledged(false); } }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              maxHeight: mobile ? "100%" : "85vh",
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
              <h2 style={{ margin: 0, fontSize: mobile ? "20px" : "22px", fontWeight: 700, color: "#ffffff" }}>
                Review Proposed Schedule Changes
              </h2>
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
              {(["added", "moved", "replaced", "removed"] as const).map((sectionType) => {
                const sectionChanges = pendingPlan.changes.filter((c) => c.type === sectionType);
                if (sectionChanges.length === 0) return null;
                const colors: Record<string, string> = { added: "#34d399", moved: "#fbbf24", replaced: "#f59e0b", removed: "#ef4444" };
                return (
                  <div key={sectionType}>
                    <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: colors[sectionType], textTransform: "uppercase", letterSpacing: "0.02em" }}>
                      {sectionType}
                    </p>
                    {sectionChanges.map((change, i) => (
                      <div key={i} style={{ padding: "10px 12px", marginBottom: "6px", backgroundColor: "#111827", borderRadius: "8px" }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#ffffff" }}>
                          {change.type === "replaced" ? (
                            <>{change.oldCourseTitle} → {change.courseTitle}</>
                          ) : (
                            change.courseTitle
                          )}
                        </p>
                        {change.type === "added" && change.location && (
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#9ca3af" }}>{change.location}</p>
                        )}
                        {change.type === "moved" && (
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#9ca3af" }}>
                            {change.fromLocation} → {change.toLocation}
                          </p>
                        )}
                        {change.type === "removed" && change.location && (
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#9ca3af" }}>{change.location}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}

              <div style={{ padding: "12px 16px", backgroundColor: pendingPlan.gradImpact.type === "warning" ? "rgba(245, 158, 11, 0.12)" : "rgba(52, 211, 153, 0.08)", border: `1px solid ${pendingPlan.gradImpact.type === "warning" ? "rgba(245, 158, 11, 0.3)" : "rgba(52, 211, 153, 0.3)"}`, borderRadius: "8px" }}>
                <p style={{ margin: 0, fontSize: "14px", color: pendingPlan.gradImpact.type === "warning" ? "#f59e0b" : "#34d399", lineHeight: 1.5 }}>
                  {pendingPlan.gradImpact.type === "warning" ? "⚠ " : "✓ "}{pendingPlan.gradImpact.message}
                </p>
              </div>

              <div style={{ padding: "16px", backgroundColor: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "8px" }}>
                <p style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 700, color: "#60a5fa" }}>
                  Important
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#d1d5db", lineHeight: 1.6 }}>
                  This planner provides scheduling suggestions based on the Stevenson High School Course Guide and your current academic plan.
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#d1d5db", lineHeight: 1.6 }}>
                  Recommendations may not account for every situation, including:
                </p>
                <ul style={{ margin: "4px 0 0", paddingLeft: "18px", fontSize: "12px", color: "#9ca3af", lineHeight: 1.7 }}>
                  <li>counselor approvals or waivers</li>
                  <li>placement tests</li>
                  <li>future course availability</li>
                  <li>schedule conflicts outside this planner</li>
                  <li>individual graduation exceptions</li>
                </ul>
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#d1d5db", lineHeight: 1.6 }}>
                  Please review these changes carefully before applying them. If you are unsure, consult your school counselor.
                </p>
                <p style={{ margin: "12px 0 0", fontSize: "11px", color: "#6b7280", lineHeight: 1.4, fontStyle: "italic" }}>
                  This planner is designed to help you explore possible schedules. Your official schedule, graduation status, and course eligibility are determined by Stevenson High School and your school counselor.
                </p>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "12px",
                  backgroundColor: "#111827",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#d1d5db",
                  lineHeight: 1.4,
                }}
              >
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  style={{ marginTop: "2px", width: "18px", height: "18px", accentColor: "var(--brand-accent)", flexShrink: 0 }}
                />
                <span>I have reviewed these proposed schedule changes.</span>
              </label>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => { setPendingPlan(null); setAcknowledged(false); }}
                  style={{
                    ...waBtnSecondary,
                    flex: 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!pendingPlan) return;
                    try {
                      await pendingPlan.execute();
                      setPendingPlan(null);
                      setAcknowledged(false);
                      onClose();
                    } catch {
                    }
                  }}
                  disabled={!acknowledged}
                  style={{
                    ...waBtnPrimary,
                    flex: 1,
                    backgroundColor: acknowledged ? "var(--brand-accent)" : "#374151",
                    cursor: acknowledged ? "pointer" : "not-allowed",
                    opacity: acknowledged ? 1 : 0.5,
                  }}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

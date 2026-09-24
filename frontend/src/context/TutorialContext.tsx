"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import {
  getActiveTutorialChapters,
  findTutorialTarget,
  type TutorialAuthState,
  type TutorialStep,
  type TutorialChapter,
} from "@/lib/tutorial";
import {
  CURRENT_TUTORIAL_VERSION,
  type Preferences,
} from "@/lib/preferences";

type TutorialContextType = {
  /** Whether the tutorial is currently open. */
  isOpen: boolean;
  /** Whether the tutorial has been completed for the current version. */
  isCompleted: boolean;
  /** The current step being displayed. */
  currentStep: TutorialStep | null;
  /** The current chapter being displayed. */
  currentChapter: TutorialChapter | null;
  /** Zero-based index of the current step across all chapters. */
  currentStepIndex: number;
  /** Zero-based index of the current chapter. */
  currentChapterIndex: number;
  /** Total number of steps across all chapters. */
  totalSteps: number;
  /** Start index of the current chapter in the flat step list. */
  chapterStartIndex: number;
  /** Number of steps in the current chapter. */
  chapterStepCount: number;
  /** Position of the current step within its chapter (1-based). */
  stepInChapter: number;
  /** Whether the current step has a valid target element. */
  hasTarget: boolean;
  /** Whether the current step requires navigation to a specific route. */
  isNavigationStep: boolean;
  /** Whether the current step requires the user to click the target element. */
  isInteractionStep: boolean;
  /** Whether the current step requires authentication. */
  isAuthStep: boolean;
  /** Whether the user has navigated to the required route (or the step has no required path). */
  navigationReady: boolean;
  /** Open the tutorial from the beginning. */
  startTutorial: () => void;
  /** Open the tutorial at a specific step. */
  goToStep: (stepId: string) => void;
  /** Advance to the next step. */
  nextStep: () => void;
  /** Go back to the previous step. */
  prevStep: () => void;
  /** Skip/exit the tutorial. */
  skipTutorial: () => void;
  /** Complete the tutorial. */
  completeTutorial: () => void;
  /** Force-show the tutorial (for re-triggering). */
  forceShow: () => void;
  /** Initiate sign-in while preserving tutorial state. */
  signInWithTutorial: () => void;
};

const TutorialContext = createContext<TutorialContextType | undefined>(
  undefined
);

function findChapterForStepIndex(
  flatIndex: number,
  chapters: TutorialChapter[]
): { chapter: TutorialChapter; chapterIndex: number; stepIndex: number } {
  let accumulated = 0;
  for (let ci = 0; ci < chapters.length; ci++) {
    const chapter = chapters[ci];
    if (flatIndex < accumulated + chapter.steps.length) {
      return {
        chapter,
        chapterIndex: ci,
        stepIndex: flatIndex - accumulated,
      };
    }
    accumulated += chapter.steps.length;
  }
  const last = chapters[chapters.length - 1];
  return {
    chapter: last,
    chapterIndex: chapters.length - 1,
    stepIndex: Math.max(0, last.steps.length - 1),
  };
}

/**
 * Check if the current pathname matches the required path.
 * Uses startsWith for paths like "/planner/" that match "/planner/12".
 */
function isPathMatch(pathname: string, requiredPath: string): boolean {
  if (requiredPath.endsWith("/")) {
    return pathname === requiredPath || pathname.startsWith(requiredPath);
  }
  return pathname === requiredPath || pathname.startsWith(requiredPath + "/");
}

export function TutorialProvider({
  preferences,
  onMarkCompleted,
  pathname,
  authState,
  children,
}: {
  preferences: Preferences;
  onMarkCompleted: () => void;
  pathname: string;
  /**
   * Tri-state authentication state. "loading" is intentionally distinct from
   * "unauthenticated" — the sign-in prerequisite only exists when the user is
   * definitively signed out, so a loading session never exposes that step.
   */
  authState: TutorialAuthState;
  children: ReactNode;
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [flatIndex, setFlatIndex] = useState(0);
  const [hasTarget, setHasTarget] = useState(false);
  const stepCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInitiatedNavRef = useRef(false);

  // Active chapters/steps for the current auth state. Auth-gated prerequisite
  // steps (e.g. "planner-auth") are filtered OUT of this sequence while
  // authentication is loading or the user is authenticated, so they can never
  // be selected as the current step — and therefore never rendered — for an
  // authenticated user. Selection is derived; there is no render-then-remove.
  const activeChapters = useMemo(
    () => getActiveTutorialChapters(authState),
    [authState]
  );
  const flatSteps = useMemo(
    () => activeChapters.flatMap((ch) => ch.steps),
    [activeChapters]
  );
  const totalSteps = flatSteps.length;

  // If the active sequence shrinks (the prerequisite is removed when auth
  // becomes known), keep a stored out-of-range index within bounds so the
  // current step stays valid. This only clamps; it never advances past the
  // user's current step.
  const clampedFlatIndex =
    flatIndex < totalSteps ? flatIndex : Math.max(0, totalSteps - 1);
  const currentStep = isOpen ? flatSteps[clampedFlatIndex] ?? null : null;

  const isCompleted =
    preferences.tutorialCompleted &&
    preferences.tutorialVersion >= CURRENT_TUTORIAL_VERSION;

  // Compute chapter/step info from the flat index within the active sequence.
  const { chapter: currentChapter, chapterIndex: currentChapterIndex, stepIndex: stepInChapter } =
    currentStep
      ? findChapterForStepIndex(clampedFlatIndex, activeChapters)
      : { chapter: null, chapterIndex: 0, stepIndex: 0 };

  const chapterStartIndex = currentChapter
    ? activeChapters.slice(0, currentChapterIndex).reduce(
        (s, ch) => s + ch.steps.length,
        0
      )
    : 0;

  const chapterStepCount = currentChapter?.steps.length ?? 0;

  // Determine if the current step requires the user to click an actual navigation element.
  const isNavigationStep = Boolean(currentStep?.requiresNavigation);
  // Determine if the current step requires the user to click the target element.
  const isInteractionStep = Boolean(currentStep?.requiresInteraction);
  // Determine if the current step requires authentication.
  const isAuthStep = Boolean(currentStep?.requiresAuth);
  const navigationReady = currentStep?.requiredPath
    ? isPathMatch(pathname, currentStep.requiredPath)
    : true;

  // Check on step change AND on route change (target may remount after navigation).
  // Poll briefly if the target is not yet in the DOM (async render after navigation).
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 150;

    const probe = () => {
      if (cancelled) return;
      if (!currentStep?.target) {
        setHasTarget(false);
        return;
      }
      const el = findTutorialTarget(currentStep.target.selector);
      if (el) {
        setHasTarget(true);
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        setHasTarget(false);
        return;
      }
      stepCheckRef.current = setTimeout(probe, intervalMs);
    };

    stepCheckRef.current = setTimeout(probe, 300);
    return () => {
      cancelled = true;
      if (stepCheckRef.current) clearTimeout(stepCheckRef.current);
    };
  }, [isOpen, currentStep, pathname]);

  // Auto-show for first-time users.
  useEffect(() => {
    if (
      !isCompleted &&
      !isOpen &&
      preferences.tutorialVersion === 0 &&
      preferences.tutorialCompleted === false
    ) {
      // Delay to let the app render first.
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, isOpen, preferences.tutorialVersion, preferences.tutorialCompleted]);

  const startTutorial = useCallback(() => {
    setFlatIndex(0);
    setIsOpen(true);
  }, []);

  const goToStep = useCallback(
    (stepId: string) => {
      const idx = flatSteps.findIndex((s) => s.id === stepId);
      if (idx >= 0) {
        setFlatIndex(idx);
        setIsOpen(true);
      }
    },
    [flatSteps]
  );

  const nextStep = useCallback(() => {
    if (clampedFlatIndex < totalSteps - 1) {
      setFlatIndex(clampedFlatIndex + 1);
    }
  }, [clampedFlatIndex, totalSteps]);

  // Detect user clicks on navigation or interaction targets for steps that require
  // user action to advance. This runs before Next.js navigation and sets a flag
  // so the pathname effect knows the route change was caused by the user's action.
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (!currentStep?.target?.selector) return;
      if (!isNavigationStep && !isInteractionStep) return;

      const target = e.target;
      if (!(target instanceof Element)) return;

      // Walk up from the click target to find a matching element.
      const selector = currentStep.target.selector;
      const match = target.closest(selector);
      if (match) {
        userInitiatedNavRef.current = true;
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isOpen, isNavigationStep, isInteractionStep, currentStep]);

  // After a user-initiated navigation, advance once the route settles.
  // This effect does NOT advance on pathname matching alone — only when
  // userInitiatedNavRef was set by the click handler above.
  useEffect(() => {
    if (!isOpen || !currentStep?.requiredPath) return;
    if (!userInitiatedNavRef.current) return;
    if (!isPathMatch(pathname, currentStep.requiredPath)) return;

    userInitiatedNavRef.current = false;

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      nextStep();
    }, 400);
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [pathname, isOpen, currentStep, nextStep]);

  const prevStep = useCallback(() => {
    if (clampedFlatIndex > 0) {
      setFlatIndex(clampedFlatIndex - 1);
    }
  }, [clampedFlatIndex]);

  const closeTutorial = useCallback(() => {
    setIsOpen(false);
    setFlatIndex(0);
  }, []);

  const skipTutorial = useCallback(() => {
    closeTutorial();
    onMarkCompleted();
  }, [closeTutorial, onMarkCompleted]);

  const completeTutorial = useCallback(() => {
    closeTutorial();
    onMarkCompleted();
  }, [closeTutorial, onMarkCompleted]);

  const forceShow = useCallback(() => {
    setFlatIndex(0);
    setIsOpen(true);
  }, []);

  const signInWithTutorial = useCallback(() => {
    localStorage.setItem(
      "stevenson-tutorial-restore",
      JSON.stringify({ flatIndex: clampedFlatIndex, isOpen: true })
    );
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/auth/google?redirect=${redirect}`;
  }, [clampedFlatIndex]);

  // Restore tutorial state after OAuth redirect (full page reload).
  useEffect(() => {
    const stored = localStorage.getItem("stevenson-tutorial-restore");
    if (stored) {
      localStorage.removeItem("stevenson-tutorial-restore");
      try {
        const { flatIndex: restoredIndex, isOpen: restoredOpen } = JSON.parse(stored);
        if (restoredOpen && typeof restoredIndex === "number" && restoredIndex >= 0 && restoredIndex < totalSteps) {
          setFlatIndex(restoredIndex);
          setIsOpen(true);
        }
      } catch {
        // Ignore malformed data.
      }
    }
  }, [totalSteps]);

  // Note: when the active sequence shrinks (the sign-in prerequisite is
  // removed once authentication resolves), clampedFlatIndex keeps the current
  // step in range without an effect — every consumer (currentStep, chapter
  // info, next/prev) derives from it, and the first navigation write-back
  // stores an in-range index. Authentication state never triggers tutorial
  // advancement by itself.

  const value: TutorialContextType = {
    isOpen,
    isCompleted,
    currentStep,
    currentChapter: currentChapter ?? null,
    currentStepIndex: clampedFlatIndex,
    currentChapterIndex,
    totalSteps,
    chapterStartIndex,
    chapterStepCount,
    stepInChapter: stepInChapter + 1,
    hasTarget,
    isNavigationStep,
    isInteractionStep,
    isAuthStep,
    navigationReady,
    startTutorial,
    goToStep,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
    forceShow,
    signInWithTutorial,
  };

  return (
    <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextType {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
}

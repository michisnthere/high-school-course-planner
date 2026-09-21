"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import {
  TUTORIAL_CHAPTERS,
  getTotalSteps,
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
};

const TutorialContext = createContext<TutorialContextType | undefined>(
  undefined
);

function getFlatSteps(): TutorialStep[] {
  return TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps);
}

function findChapterForStepIndex(
  flatIndex: number
): { chapter: TutorialChapter; chapterIndex: number; stepIndex: number } {
  let accumulated = 0;
  for (let ci = 0; ci < TUTORIAL_CHAPTERS.length; ci++) {
    const chapter = TUTORIAL_CHAPTERS[ci];
    if (flatIndex < accumulated + chapter.steps.length) {
      return {
        chapter,
        chapterIndex: ci,
        stepIndex: flatIndex - accumulated,
      };
    }
    accumulated += chapter.steps.length;
  }
  const last = TUTORIAL_CHAPTERS[TUTORIAL_CHAPTERS.length - 1];
  return {
    chapter: last,
    chapterIndex: TUTORIAL_CHAPTERS.length - 1,
    stepIndex: last.steps.length - 1,
  };
}

export function TutorialProvider({
  preferences,
  onMarkCompleted,
  children,
}: {
  preferences: Preferences;
  onMarkCompleted: () => void;
  children: ReactNode;
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [flatIndex, setFlatIndex] = useState(0);
  const [hasTarget, setHasTarget] = useState(false);
  const stepCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatSteps = getFlatSteps();
  const totalSteps = flatSteps.length;
  const currentStep = isOpen ? flatSteps[flatIndex] ?? null : null;

  const isCompleted =
    preferences.tutorialCompleted &&
    preferences.tutorialVersion >= CURRENT_TUTORIAL_VERSION;

  // Compute chapter/step info from flat index.
  const { chapter: currentChapter, chapterIndex: currentChapterIndex, stepIndex: stepInChapter } =
    currentStep
      ? findChapterForStepIndex(flatIndex)
      : { chapter: null, chapterIndex: 0, stepIndex: 0 };

  const chapterStartIndex = currentChapter
    ? TUTORIAL_CHAPTERS.slice(0, currentChapterIndex).reduce(
        (s, ch) => s + ch.steps.length,
        0
      )
    : 0;

  const chapterStepCount = currentChapter?.steps.length ?? 0;

  // Check if the current step's target element exists in the DOM.
  const checkTarget = useCallback(() => {
    if (!currentStep?.target) {
      setHasTarget(false);
      return;
    }
    const el = document.querySelector(currentStep.target.selector);
    setHasTarget(el !== null);
  }, [currentStep]);

  useEffect(() => {
    if (isOpen && currentStep) {
      // Delay slightly to allow DOM to render after navigation.
      if (stepCheckRef.current) clearTimeout(stepCheckRef.current);
      stepCheckRef.current = setTimeout(checkTarget, 300);
      return () => {
        if (stepCheckRef.current) clearTimeout(stepCheckRef.current);
      };
    }
  }, [isOpen, currentStep, checkTarget]);

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
    if (flatIndex < totalSteps - 1) {
      setFlatIndex((i) => i + 1);
    }
  }, [flatIndex, totalSteps]);

  const prevStep = useCallback(() => {
    if (flatIndex > 0) {
      setFlatIndex((i) => i - 1);
    }
  }, [flatIndex]);

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

  const value: TutorialContextType = {
    isOpen,
    isCompleted,
    currentStep,
    currentChapter: currentChapter ?? null,
    currentStepIndex: flatIndex,
    currentChapterIndex,
    totalSteps,
    chapterStartIndex,
    chapterStepCount,
    stepInChapter: stepInChapter + 1,
    hasTarget,
    startTutorial,
    goToStep,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
    forceShow,
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

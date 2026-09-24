"use client";

export type TutorialStepTarget = {
  /** CSS selector or data-tour attribute value for the target element. */
  selector: string;
  /** Whether to scroll the target into view before highlighting. */
  scrollIntoView?: boolean;
  /** Where to position the popup relative to the target. */
  position?: "top" | "bottom" | "left" | "right";
};

export type TutorialStep = {
  /** Unique step identifier. */
  id: string;
  /** Translation key for the step title. */
  titleKey: string;
  /** Translation key for the step description. */
  descriptionKey: string;
  /** Optional target element to highlight. If omitted, shows a centered popup. */
  target?: TutorialStepTarget;
  /** Whether this step requires a specific page to be loaded. */
  requiredPath?: string;
  /** Translation key for the navigation action button label (e.g., "Go to Course Catalog"). */
  navigationLabelKey?: string;
  /** Whether the user must click an actual website navigation element to advance. */
  requiresNavigation?: boolean;
  /** Whether the user must click the target element to advance (no Next button). */
  requiresInteraction?: boolean;
  /** Whether this step requires the user to be authenticated. */
  requiresAuth?: boolean;
};

export type TutorialChapter = {
  /** Unique chapter identifier. */
  id: string;
  /** Translation key for the chapter name. */
  nameKey: string;
  /** Steps in this chapter. */
  steps: TutorialStep[];
};

export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    id: "welcome",
    nameKey: "tutorial.chapters.welcome",
    steps: [
      {
        id: "welcome-intro",
        titleKey: "tutorial.steps.welcomeIntro.title",
        descriptionKey: "tutorial.steps.welcomeIntro.description",
      },
    ],
  },
  {
    id: "explore-courses",
    nameKey: "tutorial.chapters.exploreCourses",
    steps: [
      {
        id: "catalog-intro",
        titleKey: "tutorial.steps.catalogIntro.title",
        descriptionKey: "tutorial.steps.catalogIntro.description",
        target: {
          selector: "[data-tour='nav-catalog']",
          position: "right",
        },
        requiredPath: "/catalog",
        navigationLabelKey: "tutorial.actions.goToCourseCatalog",
        requiresNavigation: true,
      },
      {
        id: "search-vs-filters",
        titleKey: "tutorial.steps.searchVsFilters.title",
        descriptionKey: "tutorial.steps.searchVsFilters.description",
        target: {
          selector: "[data-tour='catalog-search']",
          position: "bottom",
        },
        requiredPath: "/catalog",
      },
      {
        id: "course-cards",
        titleKey: "tutorial.steps.courseCards.title",
        descriptionKey: "tutorial.steps.courseCards.description",
        target: {
          selector: "[data-tutorial-target='course-algebra-1']",
          position: "left",
        },
        requiredPath: "/catalog/algebra-1",
        requiresInteraction: true,
      },
      {
        id: "course-detail-overview",
        titleKey: "tutorial.steps.courseDetailOverview.title",
        descriptionKey: "tutorial.steps.courseDetailOverview.description",
        target: {
          selector: ".rs-detail-header",
          position: "right",
        },
        requiredPath: "/catalog/algebra-1",
      },
      {
        id: "course-detail-offerings",
        titleKey: "tutorial.steps.courseDetailOfferings.title",
        descriptionKey: "tutorial.steps.courseDetailOfferings.description",
        target: {
          selector: "[data-tutorial-target='course-offerings']",
          position: "right",
        },
        requiredPath: "/catalog/algebra-1",
      },
      {
        id: "course-detail-prerequisites",
        titleKey: "tutorial.steps.courseDetailPrerequisites.title",
        descriptionKey: "tutorial.steps.courseDetailPrerequisites.description",
        target: {
          selector: "[data-tutorial-target='course-prerequisites']",
          position: "right",
        },
        requiredPath: "/catalog/algebra-1",
      },
    ],
  },
  {
    id: "build-plan",
    nameKey: "tutorial.chapters.buildPlan",
    steps: [
      {
        id: "planner-auth",
        titleKey: "tutorial.steps.plannerAuth.title",
        descriptionKey: "tutorial.steps.plannerAuth.description",
        requiresAuth: true,
      },
      {
        id: "planner-intro",
        titleKey: "tutorial.steps.plannerIntro.title",
        descriptionKey: "tutorial.steps.plannerIntro.description",
        target: {
          selector: "[data-tour='nav-planner']",
          position: "right",
        },
        requiredPath: "/planner",
        navigationLabelKey: "tutorial.actions.goToMyPlanner",
        requiresNavigation: true,
      },
      {
        id: "four-years-semesters",
        titleKey: "tutorial.steps.fourYearsSemesters.title",
        descriptionKey: "tutorial.steps.fourYearsSemesters.description",
        target: {
          selector: "[data-tour='planner-years']",
          position: "bottom",
        },
        requiredPath: "/planner",
      },
      {
        id: "adding-courses",
        titleKey: "tutorial.steps.addingCourses.title",
        descriptionKey: "tutorial.steps.addingCourses.description",
        target: {
          selector: "[data-tour='planner-add-course']",
          position: "top",
        },
        requiredPath: "/planner/",
      },
      {
        id: "course-eligibility",
        titleKey: "tutorial.steps.courseEligibility.title",
        descriptionKey: "tutorial.steps.courseEligibility.description",
      },
      {
        id: "removing-courses",
        titleKey: "tutorial.steps.removingCourses.title",
        descriptionKey: "tutorial.steps.removingCourses.description",
      },
      {
        id: "waivers",
        titleKey: "tutorial.steps.waivers.title",
        descriptionKey: "tutorial.steps.waivers.description",
      },
    ],
  },
  {
    id: "check-plan",
    nameKey: "tutorial.chapters.checkPlan",
    steps: [
      {
        id: "needs-attention",
        titleKey: "tutorial.steps.needsAttention.title",
        descriptionKey: "tutorial.steps.needsAttention.description",
        target: {
          selector: "[data-tour='planner-warnings']",
          position: "top",
        },
        requiredPath: "/planner/",
      },
      {
        id: "understanding-warnings",
        titleKey: "tutorial.steps.understandingWarnings.title",
        descriptionKey: "tutorial.steps.understandingWarnings.description",
      },
      {
        id: "resolving-warnings",
        titleKey: "tutorial.steps.resolvingWarnings.title",
        descriptionKey: "tutorial.steps.resolvingWarnings.description",
      },
      {
        id: "credit-progress",
        titleKey: "tutorial.steps.creditProgress.title",
        descriptionKey: "tutorial.steps.creditProgress.description",
        target: {
          selector: "[data-tour='planner-summary']",
          position: "left",
        },
        requiredPath: "/planner/",
      },
    ],
  },
  {
    id: "track-graduation",
    nameKey: "tutorial.chapters.trackGraduation",
    steps: [
      {
        id: "graduation-requirements",
        titleKey: "tutorial.steps.graduationRequirements.title",
        descriptionKey: "tutorial.steps.graduationRequirements.description",
        target: {
          selector: "[data-tour='nav-requirements']",
          position: "right",
        },
        requiredPath: "/requirements",
        navigationLabelKey: "tutorial.actions.goToGraduationRequirements",
        requiresNavigation: true,
      },
      {
        id: "requirement-progress",
        titleKey: "tutorial.steps.requirementProgress.title",
        descriptionKey: "tutorial.steps.requirementProgress.description",
        target: {
          selector: "[data-tour='requirements-grid']",
          position: "top",
        },
        requiredPath: "/requirements",
      },
    ],
  },
  {
    id: "keep-records",
    nameKey: "tutorial.chapters.keepRecords",
    steps: [
      {
        id: "completed-courses",
        titleKey: "tutorial.steps.completedCourses.title",
        descriptionKey: "tutorial.steps.completedCourses.description",
        target: {
          selector: "[data-tour='nav-completed']",
          position: "right",
        },
        requiredPath: "/completed-courses",
        navigationLabelKey: "tutorial.actions.goToCompletedCourses",
        requiresNavigation: true,
      },
      {
        id: "saved-courses",
        titleKey: "tutorial.steps.savedCourses.title",
        descriptionKey: "tutorial.steps.savedCourses.description",
        target: {
          selector: "[data-tour='nav-saved']",
          position: "right",
        },
        requiredPath: "/saved",
        navigationLabelKey: "tutorial.actions.goToSavedCourses",
        requiresNavigation: true,
      },
    ],
  },
  {
    id: "personalize",
    nameKey: "tutorial.chapters.personalize",
    steps: [
      {
        id: "language",
        titleKey: "tutorial.steps.language.title",
        descriptionKey: "tutorial.steps.language.description",
        target: {
          selector: "[data-tour='language-settings']",
          position: "bottom",
        },
      },
      {
        id: "accessibility",
        titleKey: "tutorial.steps.accessibility.title",
        descriptionKey: "tutorial.steps.accessibility.description",
        target: {
          selector: "[data-tour='a11y-settings']",
          position: "bottom",
        },
      },
      {
        id: "account-guest",
        titleKey: "tutorial.steps.accountGuest.title",
        descriptionKey: "tutorial.steps.accountGuest.description",
      },
    ],
  },
];

export function getTotalSteps(): number {
  return TUTORIAL_CHAPTERS.reduce(
    (sum, chapter) => sum + chapter.steps.length,
    0
  );
}

/**
 * Resolve a tutorial target selector to a single visible element.
 *
 * Both Header and MobileAppBar render LanguageSettingsButton and
 * AccessibilitySettingsButton, so data-tour selectors can match two nodes —
 * one of which is always display:none. querySelector would return the hidden
 * first match (zero rect), producing a spotlight on the wrong control.
 * Prefer the first match that actually occupies layout space.
 */
export function findTutorialTarget(selector: string): Element | null {
  if (typeof document === "undefined") return null;
  const matches = document.querySelectorAll(selector);
  for (const el of matches) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

export function getChapterStartIndex(chapterIndex: number): number {
  let index = 0;
  for (let i = 0; i < chapterIndex; i++) {
    index += TUTORIAL_CHAPTERS[i].steps.length;
  }
  return index;
}

export function findStepById(
  stepId: string
): { chapter: TutorialChapter; chapterIndex: number; step: TutorialStep; stepIndex: number } | null {
  for (let ci = 0; ci < TUTORIAL_CHAPTERS.length; ci++) {
    const chapter = TUTORIAL_CHAPTERS[ci];
    for (let si = 0; si < chapter.steps.length; si++) {
      if (chapter.steps[si].id === stepId) {
        return { chapter, chapterIndex: ci, step: chapter.steps[si], stepIndex: si };
      }
    }
  }
  return null;
}

/**
 * The three authentication states the tutorial distinguishes when deciding
 * whether the sign-in prerequisite step exists.
 *
 * "loading" must NEVER be treated as "unauthenticated": while authentication
 * is still resolving we do not know whether the user is signed in, so the
 * sign-in prerequisite must not be part of the active step sequence.
 */
export type TutorialAuthState = "loading" | "authenticated" | "unauthenticated";

/**
 * Map the application's auth provider flags onto the tutorial's tri-state
 * auth state. Loading/unknown wins over the (default-false) isAuthenticated
 * flag so a loading session is never classified as signed out.
 */
export function resolveTutorialAuthState(
  loading: boolean,
  isAuthenticated: boolean
): TutorialAuthState {
  if (loading) return "loading";
  return isAuthenticated ? "authenticated" : "unauthenticated";
}

/**
 * Chapters for the given auth state, with auth-gated prerequisite steps
 * excluded unless the user is definitively unauthenticated.
 *
 * The sign-in prerequisite (`requiresAuth`) is excluded while authentication
 * is loading AND while authenticated, so an authenticated user can never
 * select — and therefore never render — that step, not even transiently.
 * There is no delayed cleanup: exclusion happens at selection time.
 */
export function getActiveTutorialChapters(
  authState: TutorialAuthState
): TutorialChapter[] {
  return TUTORIAL_CHAPTERS.map((chapter) => ({
    ...chapter,
    steps: chapter.steps.filter(
      (step) => !step.requiresAuth || authState === "unauthenticated"
    ),
  })).filter((chapter) => chapter.steps.length > 0);
}

/**
 * Flat active step sequence for the given auth state. This is the sequence
 * the tutorial's index-based step selection operates on.
 */
export function getActiveTutorialSteps(
  authState: TutorialAuthState
): TutorialStep[] {
  return getActiveTutorialChapters(authState).flatMap(
    (chapter) => chapter.steps
  );
}

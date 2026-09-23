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
          selector: "[data-tour='catalog-grid']",
          position: "top",
        },
        requiredPath: "/catalog",
      },
    ],
  },
  {
    id: "build-plan",
    nameKey: "tutorial.chapters.buildPlan",
    steps: [
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
        id: "moving-courses",
        titleKey: "tutorial.steps.movingCourses.title",
        descriptionKey: "tutorial.steps.movingCourses.description",
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
          selector: "[data-tour='a11y-settings']",
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

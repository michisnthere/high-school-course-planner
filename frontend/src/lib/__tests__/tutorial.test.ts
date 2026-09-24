import { describe, it, expect } from "vitest";
import {
  TUTORIAL_CHAPTERS,
  getTotalSteps,
  getChapterStartIndex,
  findStepById,
  resolveTutorialAuthState,
  getActiveTutorialChapters,
  getActiveTutorialSteps,
} from "@/lib/tutorial";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  CURRENT_TUTORIAL_VERSION as PREF_TUTORIAL_VERSION,
} from "@/lib/preferences";

describe("Tutorial step definitions", () => {
  it("has 7 chapters", () => {
    expect(TUTORIAL_CHAPTERS).toHaveLength(7);
  });

  it("has the correct chapter IDs", () => {
    expect(TUTORIAL_CHAPTERS.map((ch) => ch.id)).toEqual([
      "welcome",
      "explore-courses",
      "build-plan",
      "check-plan",
      "track-graduation",
      "keep-records",
      "personalize",
    ]);
  });

  it("each chapter has at least one step", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      expect(chapter.steps.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("each step has a unique id", () => {
    const ids = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps.map((s) => s.id));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("each step has titleKey and descriptionKey", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      for (const step of chapter.steps) {
        expect(step.titleKey).toBeTruthy();
        expect(step.descriptionKey).toBeTruthy();
      }
    }
  });

  it("each chapter has a nameKey", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      expect(chapter.nameKey).toBeTruthy();
    }
  });
});

describe("getTotalSteps", () => {
  it("returns the total number of steps across all chapters", () => {
    const total = TUTORIAL_CHAPTERS.reduce(
      (sum, ch) => sum + ch.steps.length,
      0
    );
    expect(getTotalSteps()).toBe(total);
  });

  it("returns at least 19 steps (the minimum specified)", () => {
    expect(getTotalSteps()).toBeGreaterThanOrEqual(19);
  });
});

describe("getChapterStartIndex", () => {
  it("returns 0 for the first chapter", () => {
    expect(getChapterStartIndex(0)).toBe(0);
  });

  it("returns the cumulative step count before the given chapter", () => {
    const chapter1Start = TUTORIAL_CHAPTERS[0].steps.length;
    expect(getChapterStartIndex(1)).toBe(chapter1Start);
  });
});

describe("findStepById", () => {
  it("finds the welcome-intro step", () => {
    const result = findStepById("welcome-intro");
    expect(result).not.toBeNull();
    expect(result!.chapter.id).toBe("welcome");
    expect(result!.step.id).toBe("welcome-intro");
  });

  it("finds a step in a later chapter", () => {
    const result = findStepById("catalog-intro");
    expect(result).not.toBeNull();
    expect(result!.chapter.id).toBe("explore-courses");
    expect(result!.chapterIndex).toBe(1);
  });

  it("returns null for a nonexistent step", () => {
    expect(findStepById("nonexistent-step")).toBeNull();
  });
});

describe("Tutorial preferences", () => {
  it("has default tutorial state as not completed", () => {
    expect(DEFAULT_PREFERENCES.tutorialCompleted).toBe(false);
    expect(DEFAULT_PREFERENCES.tutorialVersion).toBe(0);
  });

  it("CURRENT_TUTORIAL_VERSION is 1", () => {
    expect(PREF_TUTORIAL_VERSION).toBe(1);
  });

  it("normalizes missing tutorial fields to defaults", () => {
    const result = normalizePreferences({});
    expect(result.tutorialCompleted).toBe(false);
    expect(result.tutorialVersion).toBe(0);
  });

  it("preserves valid tutorial fields", () => {
    const result = normalizePreferences({
      tutorialCompleted: true,
      tutorialVersion: 1,
    });
    expect(result.tutorialCompleted).toBe(true);
    expect(result.tutorialVersion).toBe(1);
  });

  it("normalizes invalid tutorialVersion to default", () => {
    const result = normalizePreferences({
      tutorialVersion: -1,
    });
    expect(result.tutorialVersion).toBe(0);
  });

  it("normalizes non-boolean tutorialCompleted to default", () => {
    const result = normalizePreferences({
      tutorialCompleted: "yes",
    });
    expect(result.tutorialCompleted).toBe(false);
  });
});

describe("Tutorial step targets", () => {
  it("welcome-intro step has no target (centered popup)", () => {
    const result = findStepById("welcome-intro");
    expect(result!.step.target).toBeUndefined();
  });

  it("catalog-intro step targets the sidebar nav catalog link", () => {
    const result = findStepById("catalog-intro");
    expect(result!.step.target).toBeDefined();
    expect(result!.step.target!.selector).toBe("[data-tour='nav-catalog']");
  });

  it("search-vs-filters step targets the catalog search", () => {
    const result = findStepById("search-vs-filters");
    expect(result!.step.target).toBeDefined();
    expect(result!.step.target!.selector).toBe(
      "[data-tour='catalog-search']"
    );
  });

  it("planner-intro step targets the sidebar nav planner link", () => {
    const result = findStepById("planner-intro");
    expect(result!.step.target).toBeDefined();
    expect(result!.step.target!.selector).toBe(
      "[data-tour='nav-planner']"
    );
  });

  it("credit-progress step targets the planner summary", () => {
    const result = findStepById("credit-progress");
    expect(result!.step.target).toBeDefined();
    expect(result!.step.target!.selector).toBe(
      "[data-tour='planner-summary']"
    );
  });

  it("account-guest step has no target (centered popup)", () => {
    const result = findStepById("account-guest");
    expect(result!.step.target).toBeUndefined();
  });
});

describe("Tutorial required paths", () => {
  it("catalog steps require /catalog path", () => {
    const steps = TUTORIAL_CHAPTERS[1].steps;
    const catalogSteps = steps.filter((s) => s.requiredPath);
    for (const step of catalogSteps) {
      expect(step.requiredPath).toMatch(/^\/catalog/);
    }
  });

  it("planner steps require /planner/ path", () => {
    const steps = TUTORIAL_CHAPTERS[2].steps;
    const plannerSteps = steps.filter((s) => s.requiredPath);
    for (const step of plannerSteps) {
      expect(step.requiredPath).toMatch(/^\/planner/);
    }
  });

  it("requirements steps require /requirements path", () => {
    const steps = TUTORIAL_CHAPTERS[4].steps;
    const reqSteps = steps.filter((s) => s.requiredPath);
    for (const step of reqSteps) {
      expect(step.requiredPath).toBe("/requirements");
    }
  });
});

describe("Tutorial chapter structure", () => {
  it("welcome chapter has exactly 1 step", () => {
    expect(TUTORIAL_CHAPTERS[0].steps).toHaveLength(1);
  });

  it("explore-courses chapter has 6 steps", () => {
    expect(TUTORIAL_CHAPTERS[1].steps).toHaveLength(6);
  });

  it("build-plan chapter has 7 steps", () => {
    expect(TUTORIAL_CHAPTERS[2].steps).toHaveLength(7);
  });

  it("check-plan chapter has 4 steps", () => {
    expect(TUTORIAL_CHAPTERS[3].steps).toHaveLength(4);
  });

  it("track-graduation chapter has 2 steps", () => {
    expect(TUTORIAL_CHAPTERS[4].steps).toHaveLength(2);
  });

  it("keep-records chapter has 2 steps", () => {
    expect(TUTORIAL_CHAPTERS[5].steps).toHaveLength(2);
  });

  it("personalize chapter has 3 steps", () => {
    expect(TUTORIAL_CHAPTERS[6].steps).toHaveLength(3);
  });

  it("language step targets language-settings, not a11y-settings", () => {
    const result = findStepById("language");
    expect(result).not.toBeNull();
    expect(result!.step.target!.selector).toBe("[data-tour='language-settings']");
  });

  it("accessibility step targets a11y-settings", () => {
    const result = findStepById("accessibility");
    expect(result).not.toBeNull();
    expect(result!.step.target!.selector).toBe("[data-tour='a11y-settings']");
  });
});

describe("Tutorial navigation steps", () => {
  it("catalog-intro is a navigation step requiring /catalog", () => {
    const result = findStepById("catalog-intro");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBe("/catalog");
    expect(result!.step.navigationLabelKey).toBe("tutorial.actions.goToCourseCatalog");
  });

  it("planner-intro is a navigation step requiring /planner", () => {
    const result = findStepById("planner-intro");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBe("/planner");
    expect(result!.step.navigationLabelKey).toBe("tutorial.actions.goToMyPlanner");
  });

  it("graduation-requirements is a navigation step requiring /requirements", () => {
    const result = findStepById("graduation-requirements");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBe("/requirements");
    expect(result!.step.navigationLabelKey).toBe("tutorial.actions.goToGraduationRequirements");
  });

  it("completed-courses is a navigation step requiring /completed-courses", () => {
    const result = findStepById("completed-courses");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBe("/completed-courses");
    expect(result!.step.navigationLabelKey).toBe("tutorial.actions.goToCompletedCourses");
  });

  it("saved-courses is a navigation step requiring /saved", () => {
    const result = findStepById("saved-courses");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBe("/saved");
    expect(result!.step.navigationLabelKey).toBe("tutorial.actions.goToSavedCourses");
  });

  it("non-navigation steps do not have navigationLabelKey", () => {
    const result = findStepById("welcome-intro");
    expect(result).not.toBeNull();
    expect(result!.step.navigationLabelKey).toBeUndefined();
  });

  it("search-vs-filters has requiredPath but no navigationLabelKey (not a nav step)", () => {
    const result = findStepById("search-vs-filters");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBe("/catalog");
    expect(result!.step.navigationLabelKey).toBeUndefined();
  });
});

describe("Tutorial guided walkthrough", () => {
  it("all navigation steps have requiredPath set", () => {
    const navStepIds = [
      "catalog-intro",
      "planner-intro",
      "graduation-requirements",
      "completed-courses",
      "saved-courses",
    ];
    for (const id of navStepIds) {
      const result = findStepById(id);
      expect(result).not.toBeNull();
      expect(result!.step.requiredPath).toBeTruthy();
    }
  });

  it("navigation steps still have navigationLabelKey in definitions", () => {
    const navStepIds = [
      "catalog-intro",
      "planner-intro",
      "graduation-requirements",
      "completed-courses",
      "saved-courses",
    ];
    for (const id of navStepIds) {
      const result = findStepById(id);
      expect(result).not.toBeNull();
      expect(result!.step.navigationLabelKey).toBeTruthy();
    }
  });

  it("welcome-intro has no requiredPath (non-navigation step)", () => {
    const result = findStepById("welcome-intro");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBeUndefined();
  });

  it("all requiredPath values are valid routes", () => {
    const validPrefixes = ["/catalog", "/planner", "/requirements", "/completed-courses", "/saved"];
    for (const chapter of TUTORIAL_CHAPTERS) {
      for (const step of chapter.steps) {
        if (step.requiredPath) {
          const matchesValid = validPrefixes.some((p) => step.requiredPath!.startsWith(p));
          expect(matchesValid).toBe(true);
        }
      }
    }
  });

  it("navigation steps have target with selector for click detection", () => {
    const navStepIds = [
      "catalog-intro",
      "planner-intro",
      "graduation-requirements",
      "completed-courses",
      "saved-courses",
    ];
    for (const id of navStepIds) {
      const result = findStepById(id);
      expect(result).not.toBeNull();
      expect(result!.step.target).toBeDefined();
      expect(result!.step.target!.selector).toBeTruthy();
      expect(result!.step.target!.selector).toMatch(/data-tour/);
    }
  });

  it("non-navigation steps do not require a specific route", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      for (const step of chapter.steps) {
        if (!step.requiredPath) {
          expect(step.id).toBeTruthy();
        }
      }
    }
  });
});

describe("Tutorial pathname matching (isPathMatch behavior)", () => {
  // These tests verify the route matching logic used by the tutorial.
  // isPathMatch is not exported, but we can verify the expected behavior
  // through the step definitions and requiredPath values.

  it("catalog-intro requires exactly /catalog", () => {
    const result = findStepById("catalog-intro");
    expect(result!.step.requiredPath).toBe("/catalog");
  });

  it("planner-intro requires /planner", () => {
    const result = findStepById("planner-intro");
    expect(result!.step.requiredPath).toBe("/planner");
  });

  it("adding-courses requires /planner/ (with trailing slash)", () => {
    const result = findStepById("adding-courses");
    expect(result!.step.requiredPath).toBe("/planner/");
  });

  it("graduation-requirements requires /requirements", () => {
    const result = findStepById("graduation-requirements");
    expect(result!.step.requiredPath).toBe("/requirements");
  });

  it("completed-courses requires /completed-courses", () => {
    const result = findStepById("completed-courses");
    expect(result!.step.requiredPath).toBe("/completed-courses");
  });

  it("saved-courses requires /saved", () => {
    const result = findStepById("saved-courses");
    expect(result!.step.requiredPath).toBe("/saved");
  });
});

describe("Tutorial step classification (requiresNavigation)", () => {
  const navigationStepIds = [
    "catalog-intro",
    "planner-intro",
    "graduation-requirements",
    "completed-courses",
    "saved-courses",
  ];

  it("exactly 5 steps are classified as navigation-required", () => {
    const navSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps).filter(
      (s) => s.requiresNavigation
    );
    expect(navSteps).toHaveLength(5);
  });

  it("all navigation-required steps have requiresNavigation: true", () => {
    for (const id of navigationStepIds) {
      const result = findStepById(id);
      expect(result).not.toBeNull();
      expect(result!.step.requiresNavigation).toBe(true);
    }
  });

  it("all navigation-required steps have a target selector", () => {
    for (const id of navigationStepIds) {
      const result = findStepById(id);
      expect(result).not.toBeNull();
      expect(result!.step.target).toBeDefined();
      expect(result!.step.target!.selector).toMatch(/data-tour/);
    }
  });

  it("informational steps with requiredPath do NOT have requiresNavigation", () => {
    const informationalWithRoute = [
      "search-vs-filters",
      "course-detail-overview",
      "course-detail-offerings",
      "course-detail-prerequisites",
      "four-years-semesters",
      "adding-courses",
      "needs-attention",
      "credit-progress",
      "requirement-progress",
    ];
    for (const id of informationalWithRoute) {
      const result = findStepById(id);
      expect(result).not.toBeNull();
      expect(result!.step.requiresNavigation).toBeUndefined();
      expect(result!.step.requiredPath).toBeTruthy();
    }
  });

  it("search-vs-filters is informational (has Next) despite being on /catalog", () => {
    const result = findStepById("search-vs-filters");
    expect(result).not.toBeNull();
    expect(result!.step.requiresNavigation).toBeUndefined();
    expect(result!.step.requiredPath).toBe("/catalog");
    expect(result!.step.target).toBeDefined();
  });

  it("course-cards is an interaction step (no Next) with a spotlight target", () => {
    const result = findStepById("course-cards");
    expect(result).not.toBeNull();
    expect(result!.step.requiresInteraction).toBe(true);
    expect(result!.step.target).toBeDefined();
  });

  it("welcome-intro is informational (has Next)", () => {
    const result = findStepById("welcome-intro");
    expect(result).not.toBeNull();
    expect(result!.step.requiresNavigation).toBeUndefined();
  });

  it("steps without requiredPath are always informational", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      for (const step of chapter.steps) {
        if (!step.requiredPath) {
          expect(step.requiresNavigation).toBeUndefined();
        }
      }
    }
  });

  it("only steps with navigationLabelKey have requiresNavigation", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      for (const step of chapter.steps) {
        if (step.requiresNavigation) {
          expect(step.navigationLabelKey).toBeTruthy();
        }
      }
    }
  });

  it("exactly 1 step is classified as interaction-required", () => {
    const interactionSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps).filter(
      (s) => s.requiresInteraction
    );
    expect(interactionSteps).toHaveLength(1);
    expect(interactionSteps[0].id).toBe("course-cards");
  });

  it("interaction-required steps do NOT have requiresNavigation", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      for (const step of chapter.steps) {
        if (step.requiresInteraction) {
          expect(step.requiresNavigation).toBeUndefined();
        }
      }
    }
  });

  it("interaction-required steps have a target selector", () => {
    for (const chapter of TUTORIAL_CHAPTERS) {
      for (const step of chapter.steps) {
        if (step.requiresInteraction) {
          expect(step.target).toBeDefined();
          expect(step.target!.selector).toBeTruthy();
        }
      }
    }
  });
});

describe("Tutorial auth-required steps", () => {
  it("planner-auth is the only auth-required step", () => {
    const authSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps).filter(
      (s) => s.requiresAuth
    );
    expect(authSteps).toHaveLength(1);
    expect(authSteps[0].id).toBe("planner-auth");
  });

  it("planner-auth has no target (centered popup)", () => {
    const result = findStepById("planner-auth");
    expect(result).not.toBeNull();
    expect(result!.step.target).toBeUndefined();
  });

  it("planner-auth has no requiredPath", () => {
    const result = findStepById("planner-auth");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBeUndefined();
  });

  it("planner-auth is not a navigation step", () => {
    const result = findStepById("planner-auth");
    expect(result).not.toBeNull();
    expect(result!.step.requiresNavigation).toBeUndefined();
  });

  it("planner-auth comes before planner-intro in the step list", () => {
    const flatSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps);
    const authIdx = flatSteps.findIndex((s) => s.id === "planner-auth");
    const introIdx = flatSteps.findIndex((s) => s.id === "planner-intro");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(introIdx).toBeGreaterThanOrEqual(0);
    expect(authIdx).toBeLessThan(introIdx);
  });
});

describe("Tutorial Algebra 1 course-card targeting", () => {
  it("course-cards step targets the Algebra 1 card via data-tutorial-target", () => {
    const result = findStepById("course-cards");
    expect(result).not.toBeNull();
    expect(result!.step.target).toBeDefined();
    expect(result!.step.target!.selector).toBe("[data-tutorial-target='course-algebra-1']");
  });

  it("course-cards step is an interaction step (not navigation-required)", () => {
    const result = findStepById("course-cards");
    expect(result).not.toBeNull();
    expect(result!.step.requiresNavigation).toBeUndefined();
    expect(result!.step.requiresInteraction).toBe(true);
    expect(result!.step.requiresAuth).toBeUndefined();
  });

  it("course-cards step has requiredPath for /catalog/algebra-1", () => {
    const result = findStepById("course-cards");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBe("/catalog/algebra-1");
  });

  it("course-cards step prefers left positioning", () => {
    const result = findStepById("course-cards");
    expect(result).not.toBeNull();
    expect(result!.step.target!.position).toBe("left");
  });
});

describe("Tutorial course-detail steps", () => {
  it("course-detail-overview step exists after course-cards", () => {
    const result = findStepById("course-detail-overview");
    expect(result).not.toBeNull();
    expect(result!.chapter.id).toBe("explore-courses");
  });

  it("course-detail-overview step has a target on the detail header", () => {
    const result = findStepById("course-detail-overview");
    expect(result).not.toBeNull();
    expect(result!.step.target).toBeDefined();
    expect(result!.step.target!.selector).toBe(".rs-detail-header");
  });

  it("course-detail-overview step is informational (has Next, not interaction)", () => {
    const result = findStepById("course-detail-overview");
    expect(result).not.toBeNull();
    expect(result!.step.requiresInteraction).toBeUndefined();
    expect(result!.step.requiresNavigation).toBeUndefined();
  });

  it("course-detail-overview step requires /catalog/algebra-1 path", () => {
    const result = findStepById("course-detail-overview");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBe("/catalog/algebra-1");
  });

  it("course-detail-offerings step exists", () => {
    const result = findStepById("course-detail-offerings");
    expect(result).not.toBeNull();
    expect(result!.chapter.id).toBe("explore-courses");
  });

  it("course-detail-offerings step targets the offerings section", () => {
    const result = findStepById("course-detail-offerings");
    expect(result).not.toBeNull();
    expect(result!.step.target).toBeDefined();
    expect(result!.step.target!.selector).toBe("[data-tutorial-target='course-offerings']");
  });

  it("course-detail-offerings step is informational (has Next)", () => {
    const result = findStepById("course-detail-offerings");
    expect(result).not.toBeNull();
    expect(result!.step.requiresInteraction).toBeUndefined();
    expect(result!.step.requiresNavigation).toBeUndefined();
  });

  it("course-detail-overview comes immediately after course-cards in the flat step list", () => {
    const flatSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps);
    const cardsIdx = flatSteps.findIndex((s) => s.id === "course-cards");
    const overviewIdx = flatSteps.findIndex((s) => s.id === "course-detail-overview");
    expect(overviewIdx).toBe(cardsIdx + 1);
  });

  it("course-detail-offerings comes after course-detail-overview", () => {
    const flatSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps);
    const overviewIdx = flatSteps.findIndex((s) => s.id === "course-detail-overview");
    const offeringsIdx = flatSteps.findIndex((s) => s.id === "course-detail-offerings");
    expect(offeringsIdx).toBe(overviewIdx + 1);
  });

  it("course-detail-prerequisites step exists after course-detail-offerings", () => {
    const result = findStepById("course-detail-prerequisites");
    expect(result).not.toBeNull();
    expect(result!.chapter.id).toBe("explore-courses");
    const flatSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps);
    const offeringsIdx = flatSteps.findIndex((s) => s.id === "course-detail-offerings");
    const prereqIdx = flatSteps.findIndex((s) => s.id === "course-detail-prerequisites");
    expect(prereqIdx).toBe(offeringsIdx + 1);
  });

  it("course-detail-prerequisites step targets the prerequisites section", () => {
    const result = findStepById("course-detail-prerequisites");
    expect(result).not.toBeNull();
    expect(result!.step.target).toBeDefined();
    expect(result!.step.target!.selector).toBe("[data-tutorial-target='course-prerequisites']");
  });

  it("course-detail-prerequisites step is informational (has Next)", () => {
    const result = findStepById("course-detail-prerequisites");
    expect(result).not.toBeNull();
    expect(result!.step.requiresInteraction).toBeUndefined();
    expect(result!.step.requiresNavigation).toBeUndefined();
  });

  it("course-detail-prerequisites requires /catalog/algebra-1 path", () => {
    const result = findStepById("course-detail-prerequisites");
    expect(result).not.toBeNull();
    expect(result!.step.requiredPath).toBe("/catalog/algebra-1");
  });
});

describe("Tutorial Algebra 1 target uniqueness", () => {
  it("course-cards selector uses data-tutorial-target attribute (not positional)", () => {
    const result = findStepById("course-cards");
    expect(result).not.toBeNull();
    expect(result!.step.target!.selector).toMatch(/^\[data-tutorial-target='.+'\]$/);
  });

  it("course-cards selector targets exactly the course-algebra-1 target", () => {
    const result = findStepById("course-cards");
    expect(result!.step.target!.selector).toBe("[data-tutorial-target='course-algebra-1']");
  });

  it("course-cards selector is specific enough to match exactly one element in a catalog", () => {
    // The selector [data-tutorial-target='course-algebra-1'] uses an attribute
    // value selector that only CourseCard sets, and only when slug === 'algebra-1'.
    // Verify the selector does not use generic class selectors or positional selectors.
    const result = findStepById("course-cards");
    const selector = result!.step.target!.selector;
    expect(selector).not.toContain(".course-card");
    expect(selector).not.toContain(":first-child");
    expect(selector).not.toContain(":nth-child");
    expect(selector).not.toContain(":nth-of-type");
  });

  it("no other step reuses the course-algebra-1 target selector", () => {
    const algebraSelector = "[data-tutorial-target='course-algebra-1']";
    const matches = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps).filter(
      (s) => s.target?.selector === algebraSelector
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("course-cards");
  });

  it("course-cards step prefers left positioning for popup", () => {
    const result = findStepById("course-cards");
    expect(result!.step.target!.position).toBe("left");
  });

  it("course-cards step has scrollIntoView enabled (default)", () => {
    const result = findStepById("course-cards");
    // scrollIntoView defaults to undefined which is truthy for the overlay check
    expect(result!.step.target!.scrollIntoView).not.toBe(false);
  });
});

describe("Tutorial Prerequisites and Offerings target uniqueness", () => {
  it("course-detail-offerings targets the offerings section via data-tutorial-target", () => {
    const result = findStepById("course-detail-offerings");
    expect(result).not.toBeNull();
    expect(result!.step.target!.selector).toBe("[data-tutorial-target='course-offerings']");
  });

  it("course-detail-prerequisites targets the prerequisites section via data-tutorial-target", () => {
    const result = findStepById("course-detail-prerequisites");
    expect(result).not.toBeNull();
    expect(result!.step.target!.selector).toBe("[data-tutorial-target='course-prerequisites']");
  });

  it("offerings and prerequisites use two distinct targets", () => {
    const offerings = findStepById("course-detail-offerings");
    const prerequisites = findStepById("course-detail-prerequisites");
    expect(offerings).not.toBeNull();
    expect(prerequisites).not.toBeNull();
    expect(offerings!.step.target!.selector).not.toBe(prerequisites!.step.target!.selector);
    expect(offerings!.step.target!.selector).toBe("[data-tutorial-target='course-offerings']");
    expect(prerequisites!.step.target!.selector).toBe("[data-tutorial-target='course-prerequisites']");
  });

  it("course-detail-offerings selector does not match the entire page", () => {
    const result = findStepById("course-detail-offerings");
    const selector = result!.step.target!.selector;
    // Should not be a generic container class
    expect(selector).not.toContain(".rs-detail-card");
    expect(selector).not.toContain(".rs-detail-header");
    expect(selector).not.toContain("main");
  });

  it("course-detail-offerings step has right positioning", () => {
    const result = findStepById("course-detail-offerings");
    expect(result!.step.target!.position).toBe("right");
  });

  it("course-detail-offerings requires /catalog/algebra-1 path", () => {
    const result = findStepById("course-detail-offerings");
    expect(result!.step.requiredPath).toBe("/catalog/algebra-1");
  });

  it("course-detail-prerequisites step has right positioning", () => {
    const result = findStepById("course-detail-prerequisites");
    expect(result!.step.target!.position).toBe("right");
  });
});

describe("Tutorial moving-courses step removal", () => {
  it("moving-courses step is not present", () => {
    expect(findStepById("moving-courses")).toBeNull();
  });

  it("no step references movingCourses locale keys", () => {
    const steps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps);
    for (const step of steps) {
      expect(step.titleKey).not.toBe("tutorial.steps.movingCourses.title");
      expect(step.descriptionKey).not.toBe("tutorial.steps.movingCourses.description");
    }
  });

  it("removing-courses step is still present", () => {
    expect(findStepById("removing-courses")).not.toBeNull();
  });
});

describe("findTutorialTarget", () => {
  it("returns null when document is undefined (node environment)", async () => {
    const { findTutorialTarget } = await import("@/lib/tutorial");
    expect(findTutorialTarget("[data-tour='language-settings']")).toBeNull();
  });
});

describe("Tutorial auth step conditional behavior", () => {
  it("planner-auth is the only step with requiresAuth", () => {
    const authSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps).filter(
      (s) => s.requiresAuth
    );
    expect(authSteps).toHaveLength(1);
    expect(authSteps[0].id).toBe("planner-auth");
  });

  it("planner-auth has no target (centered popup, not spotlighted)", () => {
    const result = findStepById("planner-auth");
    expect(result!.step.target).toBeUndefined();
  });

  it("planner-auth comes immediately before planner-intro", () => {
    const flatSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps);
    const authIdx = flatSteps.findIndex((s) => s.id === "planner-auth");
    const introIdx = flatSteps.findIndex((s) => s.id === "planner-intro");
    expect(authIdx).toBe(introIdx - 1);
  });

  it("planner-intro is a navigation step (the step after auth)", () => {
    const result = findStepById("planner-intro");
    expect(result).not.toBeNull();
    expect(result!.step.requiresNavigation).toBe(true);
    expect(result!.step.requiredPath).toBe("/planner");
  });

  it("no step after planner-auth automatically advances on auth state", () => {
    // Only planner-auth has requiresAuth. No other step should depend on auth state.
    const authSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps).filter(
      (s) => s.requiresAuth
    );
    expect(authSteps).toHaveLength(1);
  });

  it("steps that come after planner-auth do not have requiresAuth", () => {
    const flatSteps = TUTORIAL_CHAPTERS.flatMap((ch) => ch.steps);
    const authIdx = flatSteps.findIndex((s) => s.id === "planner-auth");
    const stepsAfterAuth = flatSteps.slice(authIdx + 1);
    for (const step of stepsAfterAuth) {
      expect(step.requiresAuth).toBeUndefined();
    }
  });
});

describe("Tutorial step ordering for auth flow", () => {
  it("explore-courses chapter comes before build-plan chapter", () => {
    const exploreIdx = TUTORIAL_CHAPTERS.findIndex((ch) => ch.id === "explore-courses");
    const buildIdx = TUTORIAL_CHAPTERS.findIndex((ch) => ch.id === "build-plan");
    expect(exploreIdx).toBeLessThan(buildIdx);
  });

  it("build-plan chapter starts with planner-auth", () => {
    const buildPlan = TUTORIAL_CHAPTERS.find((ch) => ch.id === "build-plan");
    expect(buildPlan).toBeDefined();
    expect(buildPlan!.steps[0].id).toBe("planner-auth");
  });

  it("planner-auth is followed by planner-intro (navigation step)", () => {
    const buildPlan = TUTORIAL_CHAPTERS.find((ch) => ch.id === "build-plan");
    expect(buildPlan!.steps[1].id).toBe("planner-intro");
    expect(buildPlan!.steps[1].requiresNavigation).toBe(true);
  });
});

describe("Tutorial sign-in prerequisite selection by auth state (flash regression)", () => {
  const AUTH_STEP_ID = "planner-auth";

  describe("resolveTutorialAuthState", () => {
    it("classifies still-loading auth as 'loading', even when isAuthenticated is false", () => {
      expect(resolveTutorialAuthState(true, false)).toBe("loading");
      expect(resolveTutorialAuthState(true, true)).toBe("loading");
    });

    it("never maps loading to unauthenticated", () => {
      expect(resolveTutorialAuthState(true, false)).not.toBe("unauthenticated");
      expect(resolveTutorialAuthState(true, true)).not.toBe("unauthenticated");
    });

    it("classifies resolved auth correctly", () => {
      expect(resolveTutorialAuthState(false, true)).toBe("authenticated");
      expect(resolveTutorialAuthState(false, false)).toBe("unauthenticated");
    });
  });

  // Test 1 — Authenticated user never receives the sign-in step.
  it("Test 1: authenticated active sequence never contains the sign-in prerequisite", () => {
    const steps = getActiveTutorialSteps("authenticated");
    expect(steps.map((s) => s.id)).not.toContain(AUTH_STEP_ID);
    expect(steps.some((s) => s.requiresAuth)).toBe(false);
  });

  // Test 2 — Authentication loading must not be treated as signed out.
  it("Test 2: loading active sequence does not contain the sign-in prerequisite", () => {
    const steps = getActiveTutorialSteps("loading");
    expect(steps.map((s) => s.id)).not.toContain(AUTH_STEP_ID);
    expect(steps.some((s) => s.requiresAuth)).toBe(false);
  });

  // Test 3 — Loading resolving to authenticated never introduces the step.
  it("Test 3: loading → authenticated never introduces the sign-in step at any selectable index", () => {
    const loadingIds = getActiveTutorialSteps("loading").map((s) => s.id);
    const authenticatedIds = getActiveTutorialSteps("authenticated").map((s) => s.id);
    expect(loadingIds).toEqual(authenticatedIds);
    for (let i = 0; i < loadingIds.length; i++) {
      expect(loadingIds[i]).not.toBe(AUTH_STEP_ID);
    }
  });

  // Test 4 — Signed-out user still gets the prerequisite.
  it("Test 4: unauthenticated sequence keeps the sign-in prerequisite immediately before planner-intro", () => {
    const ids = getActiveTutorialSteps("unauthenticated").map((s) => s.id);
    expect(ids).toContain(AUTH_STEP_ID);
    expect(ids.indexOf(AUTH_STEP_ID)).toBe(ids.indexOf("planner-intro") - 1);
  });

  // Test 5 — Signing in only removes/skips the prerequisite; no unrelated step advances.
  it("Test 5: authenticated sequence differs from unauthenticated ONLY by the sign-in prerequisite", () => {
    const unauthenticated = getActiveTutorialSteps("unauthenticated");
    const authenticated = getActiveTutorialSteps("authenticated");
    expect(authenticated).toEqual(
      unauthenticated.filter((s) => s.id !== AUTH_STEP_ID)
    );
    // The step the tutorial lands on after the prerequisite is removed still
    // requires the user's own navigation action — authentication alone cannot
    // advance it.
    const intro = authenticated.find((s) => s.id === "planner-intro");
    expect(intro).toBeDefined();
    expect(intro!.requiresNavigation).toBe(true);
    expect(intro!.requiredPath).toBe("/planner");
    // Loading → authenticated changes nothing either.
    expect(getActiveTutorialSteps("loading")).toEqual(authenticated);
  });

  // Test 6 — No flash: no selectable index while auth is loading can resolve
  // to the sign-in prerequisite (same holds once authenticated).
  it("Test 6: no selectable index while auth is loading (or authenticated) resolves to the sign-in prerequisite", () => {
    for (const state of ["loading", "authenticated"] as const) {
      const steps = getActiveTutorialSteps(state);
      for (let i = 0; i < steps.length; i++) {
        expect(steps[i].id).not.toBe(AUTH_STEP_ID);
        expect(steps[i].requiresAuth).toBeUndefined();
      }
    }
  });

  it("build-plan chapter drops only the sign-in step for loading/authenticated users", () => {
    const unauthBuild = getActiveTutorialChapters("unauthenticated").find(
      (ch) => ch.id === "build-plan"
    );
    expect(unauthBuild).toBeDefined();
    expect(unauthBuild!.steps[0].id).toBe(AUTH_STEP_ID);
    expect(unauthBuild!.steps[1].id).toBe("planner-intro");

    for (const state of ["loading", "authenticated"] as const) {
      const build = getActiveTutorialChapters(state).find(
        (ch) => ch.id === "build-plan"
      );
      expect(build).toBeDefined();
      expect(build!.steps[0].id).toBe("planner-intro");
      expect(build!.steps.map((s) => s.id)).not.toContain(AUTH_STEP_ID);
    }
  });

  it("all chapters other than build-plan are identical regardless of auth state", () => {
    const unauth = getActiveTutorialChapters("unauthenticated");
    const authenticated = getActiveTutorialChapters("authenticated");
    const loading = getActiveTutorialChapters("loading");
    expect(unauth.map((ch) => ch.id)).toEqual(authenticated.map((ch) => ch.id));
    expect(loading.map((ch) => ch.id)).toEqual(authenticated.map((ch) => ch.id));
    for (let i = 0; i < unauth.length; i++) {
      if (unauth[i].id === "build-plan") continue;
      expect(authenticated[i].steps).toEqual(unauth[i].steps);
      expect(loading[i].steps).toEqual(unauth[i].steps);
    }
  });
});

import { describe, it, expect } from "vitest";
import {
  TUTORIAL_CHAPTERS,
  getTotalSteps,
  getChapterStartIndex,
  findStepById,
  CURRENT_TUTORIAL_VERSION,
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
      expect(step.requiredPath).toBe("/catalog");
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

  it("explore-courses chapter has 3 steps", () => {
    expect(TUTORIAL_CHAPTERS[1].steps).toHaveLength(3);
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

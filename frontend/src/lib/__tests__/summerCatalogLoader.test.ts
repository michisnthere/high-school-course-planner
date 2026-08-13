import { describe, it, expect, vi } from "vitest";
import type { SummerCourse } from "../summerCourse";
import {
  summerCatalogReducer,
  shouldFetchSummerCourses,
  loadSummerCatalog,
  SUMMER_LOAD_ERROR_MESSAGE,
  type SummerCatalogState,
} from "../summerCatalogLoader";

function makeCourse(overrides: Partial<SummerCourse> = {}): SummerCourse {
  return {
    id: 1,
    key: "summer-1",
    title: "Algebra I",
    courseCode: "MATH-A1",
    description: null,
    creditStatus: "credit",
    credits: 1,
    creditType: null,
    duration: "one_session",
    durationNote: null,
    cost: null,
    meetings: [],
    prerequisites: [],
    corequisites: [],
    fulfillsRequirements: [],
    isSummerOnly: false,
    division: "Mathematics",
    instructionalCreditType: null,
    attributes: [],
    notes: [],
    sourcePage: null,
    sourceReference: null,
    regularCourseId: null,
    regularCourse: null,
    matchedTitle: null,
    ...overrides,
  };
}

describe("summerCatalogReducer", () => {
  it("starts in idle and transitions to loading on load", () => {
    const state = summerCatalogReducer({ status: "idle" }, { type: "load" });
    expect(state.status).toBe("loading");
  });

  it("successfully loads 35 courses (loading -> success)", () => {
    const courses = Array.from({ length: 35 }, (_, i) => makeCourse({ id: i + 1, key: `summer-${i + 1}` }));
    const state = summerCatalogReducer({ status: "loading" }, { type: "loaded", courses });
    expect(state.status).toBe("success");
    if (state.status === "success") {
      expect(state.courses).toHaveLength(35);
    }
  });

  it("transitions to error on a failed request (loading -> error)", () => {
    const state = summerCatalogReducer(
      { status: "loading" },
      { type: "failed", message: SUMMER_LOAD_ERROR_MESSAGE }
    );
    expect(state).toEqual({ status: "error", message: SUMMER_LOAD_ERROR_MESSAGE });
  });

  it("error is a stable terminal state — it does NOT loop back to loading on its own", () => {
    const errorState: SummerCatalogState = {
      status: "error",
      message: SUMMER_LOAD_ERROR_MESSAGE,
    };
    // No action besides an explicit `load` can move out of error: re-applying
    // the failure keeps it in error.
    const stillError = summerCatalogReducer(
      errorState,
      { type: "failed", message: SUMMER_LOAD_ERROR_MESSAGE }
    );
    expect(stillError.status).toBe("error");
    // The only way back to loading is a deliberate `load` (e.g. Retry).
    const retried = summerCatalogReducer(errorState, { type: "load" });
    expect(retried.status).toBe("loading");
  });

  it("does not mutate the courses array it is given (decoupled from callers)", () => {
    const courses = [makeCourse()];
    const before = courses[0].title;
    summerCatalogReducer({ status: "loading" }, { type: "loaded", courses });
    expect(courses[0].title).toBe(before);
  });
});

describe("shouldFetchSummerCourses", () => {
  it("returns true from idle (first load) and error (retry allowed)", () => {
    expect(shouldFetchSummerCourses({ status: "idle" })).toBe(true);
    expect(shouldFetchSummerCourses({ status: "error", message: "x" })).toBe(true);
  });

  it("returns false while loading or after success — requests never re-trigger themselves", () => {
    expect(shouldFetchSummerCourses({ status: "loading" })).toBe(false);
    expect(shouldFetchSummerCourses({ status: "success", courses: [] })).toBe(false);
  });
});

describe("loadSummerCatalog", () => {
  it("performs exactly one request and resolves with the courses", async () => {
    const courses = Array.from({ length: 35 }, (_, i) => makeCourse({ id: i + 1 }));
    const fetcher = vi.fn(async () => courses);
    const result = await loadSummerCatalog(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(35);
  });

  it("does not auto-retry after a failure — one request, then it rejects", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(loadSummerCatalog(fetcher)).rejects.toThrow("boom");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("resolves summer-only courses (no regular course match) without failing", async () => {
    const summerOnly = [makeCourse({ isSummerOnly: true, regularCourseId: null })];
    const fetcher = vi.fn(async () => summerOnly);
    const result = await loadSummerCatalog(fetcher);
    expect(result).toHaveLength(1);
    expect(result[0].isSummerOnly).toBe(true);
  });
});
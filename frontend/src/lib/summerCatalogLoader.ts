import { useCallback, useEffect, useReducer } from "react";
import { getSummerCourses, type SummerCourse } from "./summerCourse";

// Finite state machine for the Summer catalog load lifecycle.
//
//   idle -> loading -> success | error
//
// `error` is a stable terminal state: it never transitions back to `loading`
// on its own. The only way back is an explicit `load` action (e.g. a Retry
// button or re-entering the Summer catalog), so the UI can never oscillate
// between "Loading Summer School courses..." and "Failed to load courses".
export type SummerCatalogState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; courses: SummerCourse[] }
  | { status: "error"; message: string };

export type SummerCatalogAction =
  | { type: "load" }
  | { type: "loaded"; courses: SummerCourse[] }
  | { type: "failed"; message: string };

export const SUMMER_LOAD_ERROR_MESSAGE = "Failed to load Summer School courses.";

export function summerCatalogReducer(
  state: SummerCatalogState,
  action: SummerCatalogAction
): SummerCatalogState {
  switch (action.type) {
    case "load":
      return { status: "loading" };
    case "loaded":
      return { status: "success", courses: action.courses };
    case "failed":
      return { status: "error", message: action.message };
    default:
      return state;
  }
}

/** Whether the effect should fire a new load. Never true from loading/success,
 * so a request can never re-trigger itself. */
export function shouldFetchSummerCourses(state: SummerCatalogState): boolean {
  return state.status !== "success" && state.status !== "loading";
}

/** Performs exactly one fetch. Does NOT retry on failure — callers decide. */
export async function loadSummerCatalog(
  fetcher?: () => Promise<SummerCourse[]>
): Promise<SummerCourse[]> {
  const fetchCourses = fetcher ?? getSummerCourses;
  return fetchCourses();
}

type UseSummerCatalogOptions = {
  /** True while the Summer catalog is the active source. */
  enabled: boolean;
  fetcher?: () => Promise<SummerCourse[]>;
};

export function useSummerCatalog({
  enabled,
  fetcher,
}: UseSummerCatalogOptions): {
  state: SummerCatalogState;
  load: () => Promise<void>;
} {
  const [state, dispatch] = useReducer(summerCatalogReducer, { status: "idle" });

  const load = useCallback(async () => {
    dispatch({ type: "load" });
    try {
      const courses = await loadSummerCatalog(fetcher);
      dispatch({ type: "loaded", courses });
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : "Unknown error";
      console.error("[summer-catalog] Failed to load Summer School courses:", detail);
      dispatch({ type: "failed", message: SUMMER_LOAD_ERROR_MESSAGE });
    }
  }, [fetcher]);

  // Initiate a load when the Summer catalog becomes active. `state` is
  // deliberately excluded from the dependencies: a successful or failed load
  // must NOT re-trigger the fetch. Only `enabled` changes (e.g. entering the
  // Summer catalog, or returning to it after an error) start a request.
  useEffect(() => {
    if (!enabled || !shouldFetchSummerCourses(state)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, load]);

  return { state, load };
}
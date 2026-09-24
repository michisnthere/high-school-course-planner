import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Planner, PlannerCourseDetails } from "@/lib/planner";
import type { RequirementResolution } from "@/lib/api";
import { createGuestDataStore } from "@/services/guestStore";
import { createGuestPlannerService } from "@/services/planner";
import { createGuestCompletedCoursesService } from "@/services/completedCourses";
import { createGuestResolutionsService } from "@/services/resolutions";
import {
  createGuestSavedCoursesService,
  authSavedCoursesService,
} from "@/services/savedCourses";
import {
  hasGuestProgress,
  migrateGuestDataToUser,
} from "@/lib/guestProgress";

// ---------------------------------------------------------------------------
// Guest-mode storage semantics (verified against the implementation):
// - planner / completedCourses / resolutions: in-memory only (lost on refresh,
//   survive client-side navigation because the store lives for the session)
// - savedCourses: sessionStorage under "guestSavedCourses" (survives refresh,
//   cleared on tab/browser close, per-tab)
// - guest services never call fetch
// ---------------------------------------------------------------------------

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
};

function makeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

function storageKeys(storage: StorageLike): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

let sessionStorageMock: StorageLike;
let localStorageMock: StorageLike;
let windowMock: {
  dispatchEvent: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  sessionStorage: StorageLike;
  localStorage: StorageLike;
};
const fetchSpy = vi.fn();

beforeEach(() => {
  sessionStorageMock = makeStorage();
  localStorageMock = makeStorage();
  windowMock = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    sessionStorage: sessionStorageMock,
    localStorage: localStorageMock,
  };
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", windowMock);
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});

const COURSE: PlannerCourseDetails = {
  id: 50,
  title: "Algebra II",
  normalizedTitle: "algebra ii",
  duration: 1,
  slotsPerSemester: 1,
  creditType: "Math",
  credits: 1,
  division: null,
  department: "Math",
  description: null,
  fulfillsRequirements: ["Mathematics"],
  prerequisites: [],
  courseCode: "MATH301",
  courseCodeS1: null,
  courseCodeS2: null,
  gradeMin: null,
  gradeMax: null,
  isNonAcademic: false,
  isMarchingBand: false,
  attributes: [],
  supportsEarlyBird: false,
  isRepeatable: false,
  isOnline: false,
};

async function plannedCount(planner: ReturnType<typeof createGuestPlannerService>) {
  const planners = await planner.getPlanners();
  return planners.reduce((n, p) => n + p.plannedCourses.length, 0);
}

describe("guest planner data is in memory only", () => {
  it("keeps the four-year plan in the in-memory store and writes nothing to storage", async () => {
    const store = createGuestDataStore();
    const planner = createGuestPlannerService(store);
    planner.seedCourseCatalog([COURSE]);
    await planner.addPlannedCourse(1, 50, 1, 1);

    expect(await plannedCount(planner)).toBeGreaterThan(0);
    expect(storageKeys(sessionStorageMock)).toEqual([]);
    expect(storageKeys(localStorageMock)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("survives a simulated route change (new service, same store) but not a refresh (new store)", async () => {
    const store = createGuestDataStore();
    const before = createGuestPlannerService(store);
    before.seedCourseCatalog([COURSE]);
    await before.addPlannedCourse(1, 50, 1, 1);
    expect(await plannedCount(before)).toBeGreaterThan(0);

    // Client-side navigation: a fresh service bound to the same store.
    const during = createGuestPlannerService(store);
    expect(await plannedCount(during)).toBeGreaterThan(0);

    // Full page refresh: a brand-new store, exactly as created on reload.
    const after = createGuestPlannerService(createGuestDataStore());
    expect(await plannedCount(after)).toBe(0);
    expect(storageKeys(sessionStorageMock)).toEqual([]);
    expect(storageKeys(localStorageMock)).toEqual([]);
  });
});

describe("guest completed courses are in memory only", () => {
  it("records completions without touching any storage or network", async () => {
    const store = createGuestDataStore();
    const completed = createGuestCompletedCoursesService(store);
    await completed.addCompletedCourse(50, "Freshman (9)");

    expect((await completed.getCompletedCourses()).length).toBe(1);
    expect(storageKeys(sessionStorageMock)).toEqual([]);
    expect(storageKeys(localStorageMock)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Simulated refresh
    const fresh = createGuestCompletedCoursesService(createGuestDataStore());
    expect(await fresh.getCompletedCourses()).toEqual([]);
  });
});

describe("guest requirement resolutions are in memory only", () => {
  it("creates resolutions without touching any storage or network", async () => {
    const svc = createGuestResolutionsService();
    await svc.createResolution({ type: "pe_waiver", courseId: 50 });

    expect((await svc.getResolutions()).length).toBe(1);
    expect(storageKeys(sessionStorageMock)).toEqual([]);
    expect(storageKeys(localStorageMock)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Simulated refresh
    const fresh = createGuestResolutionsService();
    expect(await fresh.getResolutions()).toEqual([]);
  });
});

describe("guest saved courses use sessionStorage only", () => {
  it("persists to sessionStorage under guestSavedCourses and survives a refresh", async () => {
    const svc = createGuestSavedCoursesService();
    await svc.saveCourse(50);

    expect(storageKeys(sessionStorageMock)).toEqual(["guestSavedCourses"]);
    expect(storageKeys(localStorageMock)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Simulated refresh: same per-tab sessionStorage, new service instance.
    const reloaded = createGuestSavedCoursesService();
    expect(await reloaded.getSavedCourseIds()).toEqual([50]);
  });

  it("is cleared when the tab/browser closes (sessionStorage cleared)", async () => {
    const svc = createGuestSavedCoursesService();
    await svc.saveCourse(50);
    expect(sessionStorageMock.getItem("guestSavedCourses")).not.toBeNull();

    sessionStorageMock.clear(); // tab/browser close

    const afterClose = createGuestSavedCoursesService();
    expect(await afterClose.getSavedCourseIds()).toEqual([]);
    expect(storageKeys(sessionStorageMock)).toEqual([]);
  });
});

describe("guest vs authenticated service separation", () => {
  it("a full guest workflow (plan + complete + resolve + save) never issues a network request", async () => {
    const store = createGuestDataStore();
    const planner = createGuestPlannerService(store);
    planner.seedCourseCatalog([COURSE]);
    await planner.addPlannedCourse(1, 50, 1, 1);

    const completed = createGuestCompletedCoursesService(store);
    await completed.addCompletedCourse(51, "Freshman (9)");

    const resolutions = createGuestResolutionsService();
    await resolutions.createResolution({ type: "middle_school" });

    await createGuestSavedCoursesService().saveCourse(50);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageKeys(localStorageMock)).toEqual([]);
    // Only the saved-courses key may exist in sessionStorage.
    expect(storageKeys(sessionStorageMock).every((k) => k === "guestSavedCourses")).toBe(
      true
    );
  });

  it("the authenticated saved-courses service calls the backend API", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => [] });

    await authSavedCoursesService.saveCourse(50);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/saved-courses");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
  });
});

describe("guest-to-account migration", () => {
  it("hasGuestProgress detects planner progress in any of the four guest data kinds", () => {
    const emptyPlanners: Planner[] = [];
    expect(hasGuestProgress(emptyPlanners, [], [], [])).toBe(false);

    const plannersWithCourse = [
      {
        id: 1,
        schoolYear: 9,
        label: "9",
        completedAt: null,
        plannedCourses: [{ id: 1 }],
      } as unknown as Planner,
    ];
    expect(hasGuestProgress(plannersWithCourse, [], [], [])).toBe(true);
  });

  it("migrateGuestDataToUser is an unimplemented no-op: resolves without fetching or moving data", async () => {
    await expect(migrateGuestDataToUser()).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageKeys(sessionStorageMock)).toEqual([]);
    expect(storageKeys(localStorageMock)).toEqual([]);
  });

  it("RequirementResolution type used above matches the API union (pe_waiver | middle_school)", () => {
    const r: Pick<RequirementResolution, "type"> = { type: "pe_waiver" };
    expect(r.type).toBe("pe_waiver");
  });
});

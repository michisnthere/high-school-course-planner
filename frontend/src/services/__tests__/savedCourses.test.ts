import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createGuestSavedCoursesService } from "@/services/savedCourses";

function makeMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    clear() { store = {}; },
    get length() { return Object.keys(store).length; },
    key(index: number) { return Object.keys(store)[index] ?? null; },
  };
}

beforeAll(() => {
  (globalThis as any).window ??= {};
});

beforeEach(() => {
  (globalThis as any).window.sessionStorage = makeMockStorage();
});

describe("guest saved courses service", () => {
  it("starts with empty saved courses", async () => {
    const svc = createGuestSavedCoursesService();
    expect(await svc.getSavedCourseIds()).toEqual([]);
  });

  it("saves a course", async () => {
    const svc = createGuestSavedCoursesService();
    await svc.saveCourse(42);
    expect(await svc.getSavedCourseIds()).toEqual([42]);
  });

  it("persists to sessionStorage after save", async () => {
    const svc = createGuestSavedCoursesService();
    await svc.saveCourse(42);
    const stored = JSON.parse(window.sessionStorage.getItem("guestSavedCourses")!);
    expect(stored).toEqual([42]);
  });

  it("restores from sessionStorage on init", async () => {
    window.sessionStorage.setItem("guestSavedCourses", JSON.stringify([15, 22]));
    const svc = createGuestSavedCoursesService();
    expect(await svc.getSavedCourseIds()).toEqual([15, 22]);
  });

  it("removes a saved course", async () => {
    const svc = createGuestSavedCoursesService();
    await svc.saveCourse(10);
    await svc.saveCourse(20);
    await svc.removeSavedCourse(10);
    expect(await svc.getSavedCourseIds()).toEqual([20]);
  });

  it("updates sessionStorage after remove", async () => {
    const svc = createGuestSavedCoursesService();
    await svc.saveCourse(10);
    await svc.saveCourse(20);
    await svc.removeSavedCourse(10);
    const stored = JSON.parse(window.sessionStorage.getItem("guestSavedCourses")!);
    expect(stored).toEqual([20]);
  });

  it("prevents duplicate saves", async () => {
    const svc = createGuestSavedCoursesService();
    await svc.saveCourse(42);
    await svc.saveCourse(42);
    expect(await svc.getSavedCourseIds()).toEqual([42]);
  });

  it("maintains stable order", async () => {
    const svc = createGuestSavedCoursesService();
    await svc.saveCourse(101);
    await svc.saveCourse(22);
    await svc.saveCourse(3);
    expect(await svc.getSavedCourseIds()).toEqual([101, 22, 3]);
  });

  it("multiple service instances use independent storage snapshots", async () => {
    const s1 = createGuestSavedCoursesService();
    await s1.saveCourse(1);
    const s2 = createGuestSavedCoursesService();
    expect(await s1.getSavedCourseIds()).toEqual([1]);
    expect(await s2.getSavedCourseIds()).toEqual([1]); // both read from sessionStorage
  });

  it("returns a copy of the array (immutable)", async () => {
    const svc = createGuestSavedCoursesService();
    await svc.saveCourse(1);
    const ids = await svc.getSavedCourseIds();
    ids.push(999);
    expect(await svc.getSavedCourseIds()).toEqual([1]);
  });

  it("handles non-existent key gracefully", () => {
    const svc = createGuestSavedCoursesService();
    expect(svc).toBeDefined();
  });
});

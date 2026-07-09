const STORAGE_KEY = "coursePlannerSavedCourses";

export function getSavedCourses(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveSavedCourses(courses: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch {
    // Storage may be unavailable; fail silently.
  }
}

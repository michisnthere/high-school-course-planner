"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSavedCoursesService } from "@/services/ServiceContext";

export function useSavedCourses() {
  const { mode, loading: authLoading } = useAuth();
  const savedService = useSavedCoursesService();
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mode !== "authenticated") {
      setSavedIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    savedService.getSavedCourseIds()
      .then((ids) => setSavedIds(ids))
      .catch(() => setSavedIds([]))
      .finally(() => setLoading(false));
  }, [mode, savedService]);

  const toggle = useCallback(
    async (courseId: number) => {
      if (mode !== "authenticated") return;

      const isSaved = savedIds.includes(courseId);
      try {
        if (isSaved) {
          await savedService.removeSavedCourse(courseId);
          setSavedIds((prev) => prev.filter((id) => id !== courseId));
        } else {
          await savedService.saveCourse(courseId);
          setSavedIds((prev) => [...prev, courseId]);
        }
      } catch {
        console.error("Failed to toggle saved course");
      }
    },
    [mode, savedIds, savedService]
  );

  const isSaved = useCallback(
    (courseId: number) => savedIds.includes(courseId),
    [savedIds]
  );

  return {
    savedIds,
    loading: loading || authLoading,
    isAuthenticated: mode === "authenticated",
    toggle,
    isSaved,
  };
}

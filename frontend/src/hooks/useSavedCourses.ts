"use client";

import { useEffect, useState, useCallback } from "react";
import { getSavedCourses, saveSavedCourses } from "@/lib/savedCourses";

const CHANGE_EVENT = "savedCoursesChange";

export function useSavedCourses() {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    const update = () => setSaved(getSavedCourses());
    update();
    window.addEventListener(CHANGE_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CHANGE_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    const current = getSavedCourses();
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    saveSavedCourses(next);
    setSaved(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const isSaved = useCallback(
    (slug: string) => saved.includes(slug),
    [saved]
  );

  return { saved, toggle, isSaved };
}

export function deriveCourseDuration(course: {
  duration?: number | null;
  options?: Array<{
    offerings?: Array<{ duration?: string | number | null }>;
  }> | null;
}): number {
  if (course.duration === 2) return 2;
  if (course.duration === 1) return 1;

  const hasFullYear = course.options?.some((option) =>
    option.offerings?.some((offering) => {
      const value = offering.duration;
      if (typeof value === "number") return value === 2;
      if (typeof value === "string") return Number(value.trim()) === 2;
      return false;
    })
  );
  return hasFullYear ? 2 : 1;
}

export function calculateTotalCredits(course: {
  options?: Array<{
    credits?: number | null;
    offerings?: Array<{ duration?: string | number | null; credits?: number | null }>;
  }> | null;
  duration?: number | null;
}): number {
  const option = course.options?.[0];
  if (option?.credits != null) {
    const semesters = deriveCourseDuration(course) === 2 ? 2 : 1;
    return option.credits * semesters;
  }

  if (option?.offerings?.[0]?.credits != null) {
    const semesters = deriveCourseDuration(course) === 2 ? 2 : 1;
    return option.offerings[0].credits * semesters;
  }

  const duration = deriveCourseDuration(course);
  return duration === 2 ? 2 : 1;
}

export function getSemesterCredits(totalCredits: number, duration: number): number {
  return duration === 2 ? totalCredits / 2 : totalCredits;
}

// A 1.5-period science course (e.g. AP Physics 1, AP Biology, AP Chemistry,
// AP Physics C) carries 1.5 credits per offering but only occupies a single
// planner slot. The planner treats slot occupancy, credit value, and Early Bird
// status as independent concepts; only slot occupancy is normalized here.
export function isOnePointFivePeriodScienceCourse(course: {
  description?: string | null;
  department?: { name?: string | null; division?: { name?: string | null } | null } | null;
  options?: Array<Record<string, unknown>> | null;
}): boolean {
  const division = course.department?.division?.name?.toLowerCase().trim();
  if (division !== "science") return false;
  if ((course.description ?? "").toLowerCase().includes("1.5 period")) return true;
  return (course.options ?? []).some((o) => {
    const credits = o.credits;
    return typeof credits === "number" && credits > 1 && credits < 2;
  });
}

export function effectiveSlotsPerSemester(course: {
  description?: string | null;
  department?: { name?: string | null; division?: { name?: string | null } | null } | null;
  options?: Array<Record<string, unknown>> | null;
  slotsPerSemester?: number | null;
}): number {
  return isOnePointFivePeriodScienceCourse(course) ? 1 : (course.slotsPerSemester ?? 1);
}

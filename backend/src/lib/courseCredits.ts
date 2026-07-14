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
    return option.offerings[0].credits;
  }

  const duration = deriveCourseDuration(course);
  return duration === 2 ? 2 : 1;
}

export function getSemesterCredits(totalCredits: number, duration: number): number {
  return duration === 2 ? totalCredits / 2 : totalCredits;
}

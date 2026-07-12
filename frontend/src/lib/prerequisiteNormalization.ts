export function normalizePrerequisite(prereq: string): string {
  const trimmed = prereq.trim().toLowerCase();
  if (trimmed === "any precalculus course" || trimmed === "any ap precalculus course") {
    return "AP Precalculus or Precalculus";
  }
  return prereq.trim();
}

export function prerequisiteMatches(
  prereq: string,
  title: string,
  courseCode: string | null
): boolean {
  const normalized = normalizePrerequisite(prereq).toLowerCase();
  const normalizedTitle = title.toLowerCase();
  const normalizedCode = (courseCode ?? "").toLowerCase();

  const alternatives = normalized.split(/\s+or\s+/);
  for (const alt of alternatives) {
    const trimmed = alt.trim();
    if (!trimmed) continue;
    if (
      normalizedTitle.includes(trimmed) ||
      trimmed.includes(normalizedTitle) ||
      trimmed.includes(normalizedCode)
    ) {
      return true;
    }
  }

  return false;
}

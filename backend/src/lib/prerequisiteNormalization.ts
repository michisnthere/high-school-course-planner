export function normalizePrerequisite(prereq: string): string {
  const trimmed = prereq.trim().toLowerCase();
  if (trimmed === "any precalculus course" || trimmed === "any ap precalculus course") {
    return "AP Precalculus or Precalculus";
  }
  return prereq.trim();
}

export function normalizePrerequisites(prereqs: string[]): string[] {
  return prereqs.map(normalizePrerequisite);
}

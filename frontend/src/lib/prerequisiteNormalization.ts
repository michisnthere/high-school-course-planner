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
  courseCode: string | null,
  aliases: string[] = []
): boolean {
  const normalizeIdentity = (value: string | null | undefined) =>
    (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const identities = new Set(
    [title, courseCode, ...aliases]
      .map(normalizeIdentity)
      .filter(Boolean)
  );
  return normalizePrerequisite(prereq)
    .split(/\s+\or\s+/i)
    .map(normalizeIdentity)
    .filter(Boolean)
    .some((alternative) => identities.has(alternative));
}

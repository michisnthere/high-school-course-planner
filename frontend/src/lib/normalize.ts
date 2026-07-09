export function normalizeTitle(title: string | null | undefined): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCourseSlug(course: { title: string; normalizedTitle?: string | null }): string {
  return course.normalizedTitle || normalizeTitle(course.title);
}

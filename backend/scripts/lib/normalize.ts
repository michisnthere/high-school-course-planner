// ---------------------------------------------------------------------------
// Normalization helpers for the course import pipeline.
//
// These utilities operate on the cleaned academic-data JSON produced by the
// extraction pipeline and are consumed by scripts/import_courses.ts. They do
// not modify the extraction pipeline, the Prisma schema, or any migrations.
// ---------------------------------------------------------------------------

/**
 * Parse a free-text semester label ("Semester 1", "SEMESTER 2",
 * "Semester 1 Only", etc.) into an integer semester number. Returns null
 * when no semester number can be confidently extracted (e.g. offerings that
 * span a full year rather than a single semester).
 */
export function parseSemester(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/([12])/);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * Parse a free-text duration ("One Semester", "Full Year", etc.) into a
 * numeric unit count, where 1.0 = one semester and 2.0 = a full year.
 *
 * Recognizes canonical labels as well as common extraction variants such as
 * hyphenated forms, numeric strings, and legacy labels. This is the single
 * source of truth for converting raw duration text into the numeric values the
 * planner expects (1 or 2).
 */
const DURATION_UNIT_MAP: Record<string, number> = {
  "one semester": 1.0,
  "half semester": 0.5,
  "one and a half semesters": 1.5,
  "full year": 2.0,
  "three semesters": 3.0,
};

export function parseDurationUnits(duration: string | null | undefined): number | null {
  if (!duration) return null;

  // Normalize whitespace and hyphens so "Full-Year", "full year", and "FULL YEAR"
  // all collapse to the same canonical form.
  const key = duration.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");

  // Canonical match.
  const canonical = DURATION_UNIT_MAP[key];
  if (canonical !== undefined) {
    return canonical;
  }

  // Numeric strings like "2", "2.0", "1", "1.0".
  const numeric = Number(key);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  // Common variant phrases used by the extraction pipeline and legacy data.
  if (key.includes("full year") || key.includes("fullyear") || key.includes("year long") || key.includes("yearlong")) {
    return 2.0;
  }
  if (key === "semester" || key.includes("one semester") || key.includes("semester only") || key.includes("semester course")) {
    return 1.0;
  }

  return null;
}

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
 * Recognizes 1.5-style fractional durations for forward-compatibility, but
 * never guesses at unrecognized text — those return null.
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
  const key = duration.trim().toLowerCase();
  return DURATION_UNIT_MAP[key] ?? null;
}

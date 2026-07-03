// ---------------------------------------------------------------------------
// Normalization helpers for the course import pipeline.
//
// These functions operate ONLY on data already produced by the Python
// extraction pipeline (data/extracted_courses.json). They do not modify the
// extraction pipeline, the Prisma schema, or any migrations — they compute a
// normalized representation that scripts/import_courses.ts maps onto the
// existing Department → Subdepartment → Course → CourseOffering tables.
// ---------------------------------------------------------------------------

export type DepartmentNormalization = {
  /** Standardized top-level department name (one of STANDARD_DEPARTMENTS),
   *  or "" if the source record had no department at all. */
  department: string;
  /** The original, un-normalized department string from the source data. */
  department_raw: string | null;
  /** Standardized subdepartment name, or null when the course belongs
   *  directly to the department with no further subdivision. */
  subdepartment: string | null;
};

// The finite, standardized set of top-level department names every course
// must resolve into.
export const STANDARD_DEPARTMENTS = [
  "Applied Arts",
  "Fine Arts",
  "Language Learning",
  "Mathematics",
  "Science",
  "Social Studies",
  "Physical Education",
  "Communication Arts",
  "Computer Science / Engineering / Technology",
] as const;

// Explicit mapping for every raw department string observed in the current
// source data. An explicit lookup (rather than a generic splitter) keeps
// every mapping auditable and guarantees no new categories are invented —
// every value maps onto one of STANDARD_DEPARTMENTS.
const KNOWN_DEPARTMENT_MAP: Record<
  string,
  { department: string; subdepartment: string | null }
> = {
  // Applied Arts family — both the compound and the bare forms of the same
  // sub-area are consolidated to the same (department, subdepartment) pair.
  "Business Education": { department: "Applied Arts", subdepartment: "Business Education" },
  "Applied Arts–business Education": { department: "Applied Arts", subdepartment: "Business Education" },
  "Family and Consumer Sciences": { department: "Applied Arts", subdepartment: "Family and Consumer Sciences" },
  "Applied Arts–family and Consumer Sciences": { department: "Applied Arts", subdepartment: "Family and Consumer Sciences" },

  // Fine Arts family
  "Fine Arts": { department: "Fine Arts", subdepartment: null },
  "Fine Arts—Visual Arts": { department: "Fine Arts", subdepartment: "Visual Arts" },
  "Fine Arts—Media Arts": { department: "Fine Arts", subdepartment: "Media Arts" },
  "Fine Arts—Dance": { department: "Fine Arts", subdepartment: "Dance" },
  "Fine Arts—Music": { department: "Fine Arts", subdepartment: "Music" },
  "Fine Arts—Theatre": { department: "Fine Arts", subdepartment: "Theatre" },

  // Language Learning family
  "Language Learning": { department: "Language Learning", subdepartment: null },
  "Language Learning—Spanish": { department: "Language Learning", subdepartment: "Spanish" },

  // Computer Science / Engineering / Technology family
  "Computer Science, Engineering and Technology (CSET)": {
    department: "Computer Science / Engineering / Technology",
    subdepartment: null,
  },
  "Technology Courses": {
    department: "Computer Science / Engineering / Technology",
    subdepartment: "Technology Courses",
  },

  // Direct passthroughs — already standardized, no subdepartment.
  "Communication Arts": { department: "Communication Arts", subdepartment: null },
  Mathematics: { department: "Mathematics", subdepartment: null },
  Science: { department: "Science", subdepartment: null },
  "Social Studies": { department: "Social Studies", subdepartment: null },

  // Rename only — "Physical Welfare" is the source's name for what the
  // standardized list calls "Physical Education".
  "Physical Welfare": { department: "Physical Education", subdepartment: null },
};

// Delimiters seen in the source data for compound "Department–Subdepartment"
// strings: an en dash (–, U+2013) and an em dash (—, U+2014).
const DASH_SPLIT_RE = /\s*[\u2013\u2014-]\s*/;

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * Normalize a raw department string from the extraction pipeline into a
 * standardized department name plus an optional subdepartment.
 *
 * - Every raw value seen in the current source data is resolved through the
 *   explicit KNOWN_DEPARTMENT_MAP (exact string match).
 * - Any *other* raw value (not present in today's data, but possible in a
 *   future extraction run) falls back to a conservative dash-split: left
 *   side becomes the department, right side becomes the subdepartment. If
 *   there is no dash, the raw string passes through unchanged as the
 *   department with no subdepartment. This fallback never invents a new
 *   subdepartment label — it only reshapes the raw string itself.
 * - A missing/blank raw department produces department: "" so the caller
 *   can decide how to handle courses with no department data at all.
 */
export function normalizeDepartment(raw: string | null | undefined): DepartmentNormalization {
  const trimmed = raw?.trim() ?? "";

  if (!trimmed) {
    return { department: "", department_raw: raw ?? null, subdepartment: null };
  }

  const known = KNOWN_DEPARTMENT_MAP[trimmed];
  if (known) {
    return { department: known.department, department_raw: trimmed, subdepartment: known.subdepartment };
  }

  if (DASH_SPLIT_RE.test(trimmed)) {
    const [left, right] = trimmed.split(DASH_SPLIT_RE);
    if (left?.trim() && right?.trim()) {
      return {
        department: left.trim(),
        department_raw: trimmed,
        subdepartment: titleCase(right.trim()),
      };
    }
  }

  return { department: trimmed, department_raw: trimmed, subdepartment: null };
}

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

-- Courses defined with mutually-exclusive options (e.g. College Prep vs
-- Accelerated, Regular vs Online, Early Bird Option vs Regular) schedule
-- different course codes in the same semester, but a student enrolls in exactly
-- ONE option per period. The import auto-detector previously summed the unique
-- codes across all options, incorrectly marking these courses as multi-period.
-- Only American Studies schedules two distinct courses (English + History) in
-- the same period and is genuinely multi-period. Normalize every other course
-- back to a single slot.
UPDATE "Course"
SET "slotsPerSemester" = 1
WHERE "slotsPerSemester" IS NOT NULL
  AND "slotsPerSemester" > 1
  AND TRIM(LOWER("title")) <> 'american studies';

-- Normalize any existing placements of single-slot courses so they render
-- single-slot regardless of a persisted slotSpan.
UPDATE "PlannedCourse" pc
SET "slotSpan" = 1
FROM "Course" c
WHERE pc."courseId" = c.id
  AND pc."slotSpan" > 1
  AND COALESCE(c."slotsPerSemester", 1) = 1;

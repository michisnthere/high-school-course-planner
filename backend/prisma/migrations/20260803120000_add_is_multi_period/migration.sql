-- Multi-period scheduling is an explicit catalog-intent property, not an
-- inference from offerings, credits, options, or duration. Courses defined with
-- mutually-exclusive delivery options (College Prep vs Accelerated, Regular vs
-- Online, Early Bird vs Regular) schedule different codes in the same semester
-- but a student enrolls in exactly ONE option per period. Add the explicit flag
-- and enforce the invariant that only designated multi-period courses occupy
-- more than one planner slot.
ALTER TABLE "Course" ADD COLUMN "isMultiPeriod" BOOLEAN NOT NULL DEFAULT false;

-- American Studies schedules English + History in the same periods and is the
-- only course explicitly designated as multi-period.
UPDATE "Course"
SET "isMultiPeriod" = true
WHERE TRIM(LOWER("title")) = 'american studies';

-- Enforce the invariant going forward: any course not designated multi-period
-- occupies exactly one planner slot.
UPDATE "Course"
SET "slotsPerSemester" = 1
WHERE "isMultiPeriod" = false
  AND "slotsPerSemester" IS NOT NULL
  AND "slotsPerSemester" > 1;

-- Normalize any persisted placements to match the corrected course definition.
UPDATE "PlannedCourse" pc
SET "slotSpan" = 1
FROM "Course" c
WHERE pc."courseId" = c.id
  AND pc."slotSpan" > 1
  AND c."isMultiPeriod" = false;

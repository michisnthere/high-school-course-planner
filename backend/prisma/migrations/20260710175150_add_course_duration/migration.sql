-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "duration" INTEGER;

-- Backfill Course.duration from existing CourseOffering values.
-- This converts the normalized numeric strings the import script writes
-- ("1" and "2") as well as any legacy textual labels (e.g., "Full Year",
-- "One Semester") into the numeric representation the planner uses.
UPDATE "Course" c
SET "duration" = COALESCE(sub.max_duration, 1)
FROM (
  SELECT co."courseId", MAX(
    CASE
      WHEN LOWER(TRIM(o."duration")) IN ('2', '2.0', 'full year', 'full-year', 'yearlong', 'year-long') THEN 2
      WHEN LOWER(TRIM(o."duration")) IN ('1', '1.0', 'one semester', 'one-semester', 'semester') THEN 1
      ELSE 1
    END
  ) AS max_duration
  FROM "CourseOption" co
  JOIN "CourseOffering" o ON o."courseOptionId" = co.id
  GROUP BY co."courseId"
) sub
WHERE c.id = sub."courseId" AND c."duration" IS NULL;



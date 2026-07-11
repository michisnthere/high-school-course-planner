-- Repair a merge-era CompletedCourse table that was marked migrated but
-- still had the old gradeLevelTaken/yearTaken shape in the live database.
ALTER TABLE "CompletedCourse"
ADD COLUMN IF NOT EXISTS "gradeCompleted" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CompletedCourse'
      AND column_name = 'gradeLevelTaken'
  ) THEN
    UPDATE "CompletedCourse"
    SET "gradeCompleted" = CASE "gradeLevelTaken"
        WHEN 6 THEN 'Middle School'
        WHEN 7 THEN 'Middle School'
        WHEN 8 THEN 'Middle School'
        WHEN 9 THEN 'Freshman (9)'
        WHEN 10 THEN 'Sophomore (10)'
        WHEN 11 THEN 'Junior (11)'
        WHEN 12 THEN 'Senior (12)'
        ELSE 'Freshman (9)'
      END
    WHERE "gradeCompleted" IS NULL;
  END IF;
END $$;

UPDATE "CompletedCourse"
SET "gradeCompleted" = 'Freshman (9)'
WHERE "gradeCompleted" IS NULL;

ALTER TABLE "CompletedCourse"
ALTER COLUMN "gradeCompleted" SET NOT NULL;

ALTER TABLE "CompletedCourse"
DROP COLUMN IF EXISTS "gradeLevelTaken",
DROP COLUMN IF EXISTS "yearTaken";

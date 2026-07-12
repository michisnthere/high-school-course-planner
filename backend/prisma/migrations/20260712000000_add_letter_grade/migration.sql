ALTER TABLE "CompletedCourse"
ADD COLUMN IF NOT EXISTS "letterGrade" TEXT;

UPDATE "CompletedCourse"
SET "letterGrade" = NULL
WHERE "letterGrade" IS NULL;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "isMarchingBand" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlannerOption" ADD COLUMN "isNonAcademic" BOOLEAN NOT NULL DEFAULT false;

-- Seed existing Study Hall and Free Period as non-academic
UPDATE "PlannerOption" SET "isNonAcademic" = true WHERE "name" IN ('Study Hall', 'Free Period');

-- Seed existing marching band courses
UPDATE "Course" SET "isMarchingBand" = true WHERE
  LOWER("title") LIKE 'freshman band%' OR
  LOWER("title") LIKE 'wind ensemble%' OR
  LOWER("title") LIKE 'symphonic band%' OR
  LOWER("title") LIKE 'wind symphony%' OR
  LOWER("title") LIKE 'color guard%';

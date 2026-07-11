-- AlterTable
ALTER TABLE "PlannedCourse" ADD COLUMN     "plannerOptionId" INTEGER,
ALTER COLUMN "courseId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PlannerOption" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 1,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "availableGrades" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "maxPerYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlannerOption_name_key" ON "PlannerOption"("name");

-- CreateIndex
CREATE INDEX "PlannedCourse_plannerOptionId_idx" ON "PlannedCourse"("plannerOptionId");

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_plannerOptionId_fkey" FOREIGN KEY ("plannerOptionId") REFERENCES "PlannerOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure every planned item is linked to exactly one of course or planner option.
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "planned_course_course_or_option"
  CHECK (("courseId" IS NOT NULL AND "plannerOptionId" IS NULL) OR ("courseId" IS NULL AND "plannerOptionId" IS NOT NULL));

-- Seed planner-only options.
INSERT INTO "PlannerOption" ("name", "duration", "credits", "availableGrades", "maxPerYear", "updatedAt")
VALUES
  ('Study Hall', 1, 0, ARRAY[9, 10, 11, 12]::INTEGER[], 2, CURRENT_TIMESTAMP),
  ('Free Period', 1, 0, ARRAY[11, 12]::INTEGER[], 2, CURRENT_TIMESTAMP);

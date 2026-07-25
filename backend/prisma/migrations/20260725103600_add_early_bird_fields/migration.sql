-- AlterTable
ALTER TABLE "Course" ADD COLUMN "supportsEarlyBird" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlannedCourse" ADD COLUMN "isEarlyBird" BOOLEAN NOT NULL DEFAULT false;


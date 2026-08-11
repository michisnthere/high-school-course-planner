-- Additive Summer School bridge: extend PlannedCourse and CompletedCourse to
-- reference SummerCourse without touching the regular catalog tables.
-- Exactly-one-of (courseId | summerCourseId | plannerOptionId) is enforced in
-- application code; Postgres UNIQUE treats NULLs as distinct, so the
-- pre-existing (userId, courseId) unique still guards regular completions and
-- the new (userId, summerCourseId) unique guards summer completions.

-- AlterTable
ALTER TABLE "CompletedCourse" ADD COLUMN "summerCourseId" INTEGER,
ALTER COLUMN "courseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlannedCourse" ADD COLUMN "summerCourseId" INTEGER;

-- CreateIndex
CREATE INDEX "CompletedCourse_userId_summerCourseId_idx" ON "CompletedCourse"("userId", "summerCourseId");

-- CreateIndex
CREATE INDEX "CompletedCourse_summerCourseId_idx" ON "CompletedCourse"("summerCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "CompletedCourse_userId_summerCourseId_key" ON "CompletedCourse"("userId", "summerCourseId");

-- CreateIndex
CREATE INDEX "PlannedCourse_summerCourseId_idx" ON "PlannedCourse"("summerCourseId");

-- AddForeignKey
ALTER TABLE "CompletedCourse" ADD CONSTRAINT "CompletedCourse_summerCourseId_fkey" FOREIGN KEY ("summerCourseId") REFERENCES "SummerCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_summerCourseId_fkey" FOREIGN KEY ("summerCourseId") REFERENCES "SummerCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
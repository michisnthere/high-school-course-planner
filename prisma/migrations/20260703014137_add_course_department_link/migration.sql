-- AlterTable
-- Adds a direct, optional Course -> Department link so a course's
-- department is always resolvable without requiring a Subdepartment.
ALTER TABLE "Course" ADD COLUMN "departmentId" INTEGER;

-- CreateIndex
CREATE INDEX "Course_departmentId_idx" ON "Course"("departmentId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

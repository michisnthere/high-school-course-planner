-- Drop the global uniqueness constraint on courseCode so that the same code
-- can be reused across different course options (e.g., College Prep vs Accelerated).
DROP INDEX "CourseOffering_courseCode_key";

-- Enforce uniqueness only within a single course option, allowing duplicate
-- course codes across different options/choices.
CREATE UNIQUE INDEX "CourseOffering_courseOptionId_courseCode_key" ON "CourseOffering"("courseOptionId", "courseCode");

-- Keep courseCode indexed so it remains fast to query by code.
CREATE INDEX "CourseOffering_courseCode_idx" ON "CourseOffering"("courseCode");

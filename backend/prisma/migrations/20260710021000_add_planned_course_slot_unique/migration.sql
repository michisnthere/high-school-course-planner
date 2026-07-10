-- CreateIndex
CREATE UNIQUE INDEX "PlannedCourse_plannerId_semester_slot_key" ON "PlannedCourse"("plannerId", "semester", "slot");


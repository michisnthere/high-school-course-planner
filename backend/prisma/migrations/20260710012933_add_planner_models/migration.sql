-- CreateTable
CREATE TABLE "Planner" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "schoolYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedCourse" (
    "id" SERIAL NOT NULL,
    "plannerId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Planner_userId_idx" ON "Planner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Planner_userId_schoolYear_key" ON "Planner"("userId", "schoolYear");

-- CreateIndex
CREATE INDEX "PlannedCourse_plannerId_idx" ON "PlannedCourse"("plannerId");

-- CreateIndex
CREATE INDEX "PlannedCourse_courseId_idx" ON "PlannedCourse"("courseId");

-- AddForeignKey
ALTER TABLE "Planner" ADD CONSTRAINT "Planner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "Planner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

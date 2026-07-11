-- CreateTable
CREATE TABLE "CompletedCourse" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "gradeLevelTaken" INTEGER NOT NULL,
    "yearTaken" INTEGER NOT NULL,
    "credits" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompletedCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompletedCourse_userId_courseId_gradeLevelTaken_yearTaken_key" ON "CompletedCourse"("userId", "courseId", "gradeLevelTaken", "yearTaken");

-- CreateIndex
CREATE INDEX "CompletedCourse_userId_idx" ON "CompletedCourse"("userId");

-- CreateIndex
CREATE INDEX "CompletedCourse_courseId_idx" ON "CompletedCourse"("courseId");

-- AddForeignKey
ALTER TABLE "CompletedCourse" ADD CONSTRAINT "CompletedCourse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedCourse" ADD CONSTRAINT "CompletedCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

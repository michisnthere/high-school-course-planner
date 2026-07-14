-- AlterTable
ALTER TABLE "GraduationRequirement" ADD COLUMN     "gradeLevel" INTEGER,
ADD COLUMN     "isMeasurable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "RequirementResolution" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "courseId" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequirementResolution_userId_idx" ON "RequirementResolution"("userId");

-- CreateIndex
CREATE INDEX "RequirementResolution_userId_type_idx" ON "RequirementResolution"("userId", "type");

-- AddForeignKey
ALTER TABLE "RequirementResolution" ADD CONSTRAINT "RequirementResolution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

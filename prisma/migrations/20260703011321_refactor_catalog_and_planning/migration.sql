/*
  Warnings:

  - You are about to drop the column `sourceReference` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `corequisites` on the `CourseOffering` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `CourseOffering` table. All the data in the column will be lost.
  - You are about to drop the column `semesterLabel` on the `CourseOffering` table. All the data in the column will be lost.
  - Added the required column `semester` to the `CourseOffering` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PLANNED', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('CREDITS', 'COMPLETION', 'RULE_BASED');

-- DropIndex
DROP INDEX "Course_departmentId_idx";

-- DropIndex
DROP INDEX "CourseOffering_courseId_idx";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "sourceReference",
ADD COLUMN     "subdepartmentId" INTEGER;

-- AlterTable
ALTER TABLE "CourseOffering" DROP COLUMN "corequisites",
DROP COLUMN "duration",
DROP COLUMN "semesterLabel",
ADD COLUMN     "durationUnits" DOUBLE PRECISION,
ADD COLUMN     "semester" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Subdepartment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,

    CONSTRAINT "Subdepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduationRequirement" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requirementType" "RequirementType" NOT NULL,
    "requiredValue" DOUBLE PRECISION,
    "description" TEXT,
    "sourceReference" TEXT,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraduationRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementCourseMap" (
    "id" SERIAL NOT NULL,
    "requirementId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,

    CONSTRAINT "RequirementCourseMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "currentGradeLevel" INTEGER NOT NULL,
    "graduationYear" INTEGER,
    "gpaUnweighted" DOUBLE PRECISION,
    "gpaWeighted" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicPlan" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Primary Plan',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedCourseEntry" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "courseOfferingId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "semesterSlot" INTEGER NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PLANNED',
    "letterGrade" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedCourseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subdepartment_departmentId_name_key" ON "Subdepartment"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementCourseMap_requirementId_courseId_key" ON "RequirementCourseMap"("requirementId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE INDEX "AcademicPlan_studentId_idx" ON "AcademicPlan"("studentId");

-- CreateIndex
CREATE INDEX "PlannedCourseEntry_planId_idx" ON "PlannedCourseEntry"("planId");

-- CreateIndex
CREATE INDEX "PlannedCourseEntry_courseOfferingId_idx" ON "PlannedCourseEntry"("courseOfferingId");

-- CreateIndex
CREATE INDEX "Course_subdepartmentId_idx" ON "Course"("subdepartmentId");

-- AddForeignKey
ALTER TABLE "Subdepartment" ADD CONSTRAINT "Subdepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_subdepartmentId_fkey" FOREIGN KEY ("subdepartmentId") REFERENCES "Subdepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCourseMap" ADD CONSTRAINT "RequirementCourseMap_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "GraduationRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCourseMap" ADD CONSTRAINT "RequirementCourseMap_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicPlan" ADD CONSTRAINT "AcademicPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourseEntry" ADD CONSTRAINT "PlannedCourseEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AcademicPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourseEntry" ADD CONSTRAINT "PlannedCourseEntry_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

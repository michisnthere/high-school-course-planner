/*
  Warnings:

  - You are about to drop the column `subdepartmentId` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the `Subdepartment` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[departmentId,title]` on the table `Course` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[divisionId,name]` on the table `Department` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `divisionId` to the `Department` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_subdepartmentId_fkey";

-- DropForeignKey
ALTER TABLE "Subdepartment" DROP CONSTRAINT "Subdepartment_departmentId_fkey";

-- DropIndex
DROP INDEX "Course_subdepartmentId_idx";

-- DropIndex
DROP INDEX "Course_subdepartmentId_title_key";

-- DropIndex
DROP INDEX "Department_name_key";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "subdepartmentId";

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "divisionId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Subdepartment";

-- CreateTable
CREATE TABLE "Division" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Division_name_key" ON "Division"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Course_departmentId_title_key" ON "Course"("departmentId", "title");

-- CreateIndex
CREATE INDEX "Department_divisionId_idx" ON "Department"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_divisionId_name_key" ON "Department"("divisionId", "name");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

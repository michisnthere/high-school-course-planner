-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subdepartment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subdepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT,
    "importKey" TEXT NOT NULL,
    "description" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '[]',
    "fulfillsRequirements" JSONB NOT NULL DEFAULT '[]',
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "sourceReference" TEXT,
    "departmentId" INTEGER,
    "subdepartmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOption" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "creditType" TEXT,
    "credits" DOUBLE PRECISION,
    "gpaWaiverOption" BOOLEAN NOT NULL DEFAULT false,
    "attributes" JSONB NOT NULL DEFAULT '[]',
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" SERIAL NOT NULL,
    "courseCode" TEXT NOT NULL,
    "semesterLabel" TEXT,
    "duration" TEXT,
    "gradeMin" INTEGER,
    "gradeMax" INTEGER,
    "prerequisites" JSONB NOT NULL DEFAULT '[]',
    "corequisites" JSONB NOT NULL DEFAULT '[]',
    "creditType" TEXT,
    "credits" DOUBLE PRECISION,
    "courseOptionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduationRequirement" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "category" TEXT,
    "requirementType" TEXT,
    "requiredValue" DOUBLE PRECISION,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "sourceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraduationRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRequirement" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "graduationRequirementId" INTEGER NOT NULL,

    CONSTRAINT "CourseRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Subdepartment_departmentId_idx" ON "Subdepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Subdepartment_departmentId_name_key" ON "Subdepartment"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Course_importKey_key" ON "Course"("importKey");

-- CreateIndex
CREATE INDEX "Course_departmentId_idx" ON "Course"("departmentId");

-- CreateIndex
CREATE INDEX "Course_subdepartmentId_idx" ON "Course"("subdepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_subdepartmentId_title_key" ON "Course"("subdepartmentId", "title");

-- CreateIndex
CREATE INDEX "CourseOption_courseId_idx" ON "CourseOption"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_courseCode_key" ON "CourseOffering"("courseCode");

-- CreateIndex
CREATE INDEX "CourseOffering_courseOptionId_idx" ON "CourseOffering"("courseOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationRequirement_name_category_requirementType_key" ON "GraduationRequirement"("name", "category", "requirementType");

-- CreateIndex
CREATE INDEX "CourseRequirement_courseId_idx" ON "CourseRequirement"("courseId");

-- CreateIndex
CREATE INDEX "CourseRequirement_graduationRequirementId_idx" ON "CourseRequirement"("graduationRequirementId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRequirement_courseId_graduationRequirementId_key" ON "CourseRequirement"("courseId", "graduationRequirementId");

-- AddForeignKey
ALTER TABLE "Subdepartment" ADD CONSTRAINT "Subdepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_subdepartmentId_fkey" FOREIGN KEY ("subdepartmentId") REFERENCES "Subdepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOption" ADD CONSTRAINT "CourseOption_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseOptionId_fkey" FOREIGN KEY ("courseOptionId") REFERENCES "CourseOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequirement" ADD CONSTRAINT "CourseRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequirement" ADD CONSTRAINT "CourseRequirement_graduationRequirementId_fkey" FOREIGN KEY ("graduationRequirementId") REFERENCES "GraduationRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

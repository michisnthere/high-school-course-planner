CREATE TABLE IF NOT EXISTS "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Course" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "importKey" TEXT NOT NULL,
    "description" TEXT,
    "gpaWaiverOption" BOOLEAN NOT NULL DEFAULT false,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "sourceReference" TEXT,
    "departmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CourseOffering" (
    "id" SERIAL NOT NULL,
    "courseCode" TEXT NOT NULL,
    "semesterLabel" TEXT,
    "duration" TEXT,
    "gradeLevels" JSONB NOT NULL DEFAULT '[]',
    "prerequisites" JSONB NOT NULL DEFAULT '[]',
    "corequisites" JSONB NOT NULL DEFAULT '[]',
    "creditType" TEXT,
    "credits" DOUBLE PRECISION,
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Course_importKey_key" ON "Course"("importKey");
CREATE INDEX IF NOT EXISTS "Course_departmentId_idx" ON "Course"("departmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CourseOffering_courseCode_key" ON "CourseOffering"("courseCode");
CREATE INDEX IF NOT EXISTS "CourseOffering_courseId_idx" ON "CourseOffering"("courseId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Course_departmentId_fkey'
    ) THEN
        ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey"
        FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CourseOffering_courseId_fkey'
    ) THEN
        ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey"
        FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

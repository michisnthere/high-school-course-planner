-- Dedicated, isolated Summer School representation (ADDITIVE ONLY).
--
-- These tables exist so the Summer School catalog can be imported without
-- touching the regular Course / CourseOption / CourseOffering / Department /
-- Division or (new) GraduationRequirement data. Summer School offerings carry
-- their own session vocabulary ("Session 1" / "Session 2") and are never
-- written into regular offering rows.

-- ---------------------------------------------------------------------------
-- SummerCourse
-- ---------------------------------------------------------------------------
CREATE TABLE "SummerCourse" (
    "id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "courseCode" TEXT,
    "description" TEXT,
    "creditStatus" TEXT NOT NULL,
    "credits" DOUBLE PRECISION,
    "gradeLevels" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "duration" TEXT NOT NULL,
    "prerequisites" JSONB NOT NULL DEFAULT '[]'::JSONB,
    "corequisites" JSONB NOT NULL DEFAULT '[]'::JSONB,
    "fulfillsRequirements" JSONB NOT NULL DEFAULT '[]'::JSONB,
    "isSummerOnly" BOOLEAN NOT NULL DEFAULT false,
    "regularCourseId" INTEGER,
    "matchedTitle" TEXT,
    "matchedCourseCode" TEXT,
    "matchConfidence" TEXT,
    "sourcePage" INTEGER NOT NULL,
    "sourceReference" TEXT,
    "notes" JSONB NOT NULL DEFAULT '[]'::JSONB,
    "extractionIssues" JSONB NOT NULL DEFAULT '[]'::JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummerCourse_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- SummerCourseSession
-- ---------------------------------------------------------------------------
CREATE TABLE "SummerCourseSession" (
    "id" INTEGER NOT NULL,
    "summerCourseId" INTEGER NOT NULL,
    "session" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SummerCourseSession_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- SummerCourseRequirement
-- ---------------------------------------------------------------------------
CREATE TABLE "SummerCourseRequirement" (
    "id" INTEGER NOT NULL,
    "summerCourseId" INTEGER NOT NULL,
    "graduationRequirementId" INTEGER NOT NULL,
    "sourceName" TEXT NOT NULL,

    CONSTRAINT "SummerCourseRequirement_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes / constraints / FKs
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "SummerCourse_key_key" ON "SummerCourse"("key");
CREATE INDEX "SummerCourse_isSummerOnly_idx" ON "SummerCourse"("isSummerOnly");
CREATE INDEX "SummerCourse_regularCourseId_idx" ON "SummerCourse"("regularCourseId");

CREATE UNIQUE INDEX "SummerCourseSession_summerCourseId_session_key"
    ON "SummerCourseSession"("summerCourseId", "session");
CREATE INDEX "SummerCourseSession_summerCourseId_idx"
    ON "SummerCourseSession"("summerCourseId");

CREATE UNIQUE INDEX "SummerCourseRequirement_summerCourseId_graduationRequirementId_key"
    ON "SummerCourseRequirement"("summerCourseId", "graduationRequirementId");
CREATE INDEX "SummerCourseRequirement_summerCourseId_idx"
    ON "SummerCourseRequirement"("summerCourseId");
CREATE INDEX "SummerCourseRequirement_graduationRequirementId_idx"
    ON "SummerCourseRequirement"("graduationRequirementId");

ALTER TABLE "SummerCourse" ADD CONSTRAINT "SummerCourse_regularCourseId_fkey"
    FOREIGN KEY ("regularCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SummerCourseSession" ADD CONSTRAINT "SummerCourseSession_summerCourseId_fkey"
    FOREIGN KEY ("summerCourseId") REFERENCES "SummerCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SummerCourseRequirement" ADD CONSTRAINT "SummerCourseRequirement_summerCourseId_fkey"
    FOREIGN KEY ("summerCourseId") REFERENCES "SummerCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SummerCourseRequirement" ADD CONSTRAINT "SummerCourseRequirement_graduationRequirementId_fkey"
    FOREIGN KEY ("graduationRequirementId") REFERENCES "GraduationRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
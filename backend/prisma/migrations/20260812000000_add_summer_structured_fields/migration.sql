-- AlterTable
ALTER TABLE "SummerCourse" ADD COLUMN     "creditType" TEXT,
ADD COLUMN     "cost" TEXT,
ADD COLUMN     "durationNote" TEXT,
ADD COLUMN     "meetings" JSONB NOT NULL DEFAULT '[]';
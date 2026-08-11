-- Corrective migration: the Summer School id columns were created as plain
-- INTEGER NOT NULL, so the autoincrement() default resolved to no sequence and
-- inserts failed with "Null constraint violation on the field (`id`)".
-- These tables are guaranteed empty (the apply that hit this rolled back), so
-- restoring SERIAL-style defaults is safe and matches every other table in the
-- schema.

CREATE SEQUENCE "SummerCourse_id_seq" AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE "SummerCourse" ALTER COLUMN "id" SET DEFAULT nextval('"SummerCourse_id_seq"'::regclass);
ALTER SEQUENCE "SummerCourse_id_seq" OWNED BY "SummerCourse"."id";

CREATE SEQUENCE "SummerCourseSession_id_seq" AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE "SummerCourseSession" ALTER COLUMN "id" SET DEFAULT nextval('"SummerCourseSession_id_seq"'::regclass);
ALTER SEQUENCE "SummerCourseSession_id_seq" OWNED BY "SummerCourseSession"."id";

CREATE SEQUENCE "SummerCourseRequirement_id_seq" AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE "SummerCourseRequirement" ALTER COLUMN "id" SET DEFAULT nextval('"SummerCourseRequirement_id_seq"'::regclass);
ALTER SEQUENCE "SummerCourseRequirement_id_seq" OWNED BY "SummerCourseRequirement"."id";
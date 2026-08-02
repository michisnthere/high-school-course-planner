-- Driver Education's catalog entry lists enrollment/eligibility criteria
-- (instruction permit, parental consent, verification of age, credit minimum,
-- ELD enrollment, freshman exclusion) in the prerequisites field. These are not
-- academic course prerequisites and were being surfaced by the planner as
-- missing/later prerequisites, producing spurious warnings. Driver Education
-- has no academic course prerequisites, so clear them.
UPDATE "CourseOffering"
SET "prerequisites" = '[]'::jsonb
WHERE "courseOptionId" IN (
  SELECT o.id
  FROM "CourseOption" o
  JOIN "Course" c ON c.id = o."courseId"
  WHERE LOWER(c.title) = 'driver education'
);

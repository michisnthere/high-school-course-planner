-- Summer school and online courses get two semester codes each:
--  3 = Summer School S1, 4 = Summer School S2, 5 = Online S1, 6 = Online S2.
-- Rows that used to use code 4 for "Online Courses" are re-encoded to 5
-- (Online S1). Code 3 already meant Summer School and stays as Summer S1.
UPDATE "PlannedCourse"
SET "semester" = 5
WHERE "semester" = 4;
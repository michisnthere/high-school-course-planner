-- 1.5-period science courses (AP Physics 1, AP Biology, AP Chemistry, AP Physics C)
-- occupy a single planner slot. The import auto-detector previously counted the
-- Early Bird offerings alongside the regular offerings, producing
-- slotsPerSemester = 2. Early Bird is a scheduling option for these courses, not
-- a second slot, so they are normalized to one slot and marked as Early Bird
-- eligible.
UPDATE "Course" c
SET "slotsPerSemester" = 1,
    "supportsEarlyBird" = true
FROM "Department" d
JOIN "Division" dv ON dv.id = d."divisionId"
WHERE c."departmentId" = d.id
  AND LOWER(dv.name) = 'science'
  AND (
    LOWER(c.description) LIKE '%1.5 period%'
    OR LOWER(c.description) LIKE '%1.5-period%'
  );

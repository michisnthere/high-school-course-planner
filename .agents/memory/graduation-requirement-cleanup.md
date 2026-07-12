---
name: Graduation-requirement cleanup after import
description: How the course import produced duplicate GraduationRequirement records and sparse CourseRequirement links, and the canonicalization strategy used to make recommendations work.
---

The PDF-to-JSON import generates a graduation-requirement table with two overlapping sets of records: the original seeded requirements (e.g. `English`, `Mathematics`) and the imported requirements (e.g. `English Graduation Requirement`, `Mathematics Graduation Requirement`). Courses are linked to the imported duplicates, while the seeded requirements remain unlinked. In addition, the import can create duplicate `Course` records when the source-reference casing changes, so many source course links never make it into the database.

**Rule of thumb when cleaning this up:**
1. Keep the original seeded requirement IDs whenever a matching one exists.
2. Rename canonical requirements to the names that appear in the source `fulfillsRequirements` strings so that the frontend’s expandable cards and the year-requirement matcher stay aligned.
3. Sync `requirementType` and `requiredValue` from the source, or completion-type requirements (e.g. `Economics or Personal Finance`) will be marked `satisfied` with no recommendations.
4. Restore `CourseRequirement` links from the source JSON by matching course title + department; the `Course.fulfillsRequirements` array alone is not enough because the import only writes it on the duplicate course records.

**Why:** The planner analysis and recommendation engine use the `CourseRequirement` table, not the `fulfillsRequirements` JSON. If the canonical seeded requirements have no links, the requirements page shows zero eligible courses and no recommendations. After cleanup, recommendations should appear under the canonical records (e.g. English, Biology, Physical Science, Elective, Health, Economics/Personal Finance).

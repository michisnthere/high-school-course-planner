---
name: Course duration normalization
description: How the planner should interpret duration strings from imported course data.
---

# Course duration normalization

The imported course catalog stores `duration` as a string on each `CourseOffering`. Common values include:

- `"Full Year"` — spans both semesters, represented as two `PlannedCourse` rows in the planner.
- `"One Semester"` — a single semester.
- Occasional numeric strings like `"2"`.

**Why:** Early planner logic treated `duration` as a numeric value. This caused full-year courses to be classified as one-semester courses, which broke full-year add/move/delete behavior and inflated the summary counts.

**How to apply:** Always normalize the `duration` field to a numeric duration (`1` for one semester, `2` for full-year) before using it in planner logic. A full-year course should be identified by any string that starts with `"full"`, equals `"full year"`, `"full-year"`, `"yearlong"`, or `"year-long"`, or by the numeric value `2`.

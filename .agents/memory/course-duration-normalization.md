---
name: Course duration normalization
description: Planner duration is a numeric value, never a string label.
---

# Course duration normalization

Course duration is a numeric value on the `Course` model: `1` for one semester, `2` for a full year. The planner API uses that value directly and never parses or compares raw duration strings like `"Full Year"` or `"One Semester"`.

**Why:** Relying on string labels in the planner made full-year detection fragile and caused full-year courses to populate only one semester. Treating duration as a typed numeric value removes ambiguity.

**How to apply:**
- Store the normalized duration on the `Course` model.
- Convert raw catalog strings to numeric values only during import or a dedicated data migration.
- Keep all planner logic (add, remove, move, summary counting) strictly numeric.
- Normalize `CourseOffering.duration` to the same numeric strings ("1" or "2") as well: the planner fallback only recognizes the numeric string "2" as full-year, so a raw label like `"Full Year"` would silently be treated as one-semester if `Course.duration` is ever null.
- Ensure the importer never leaves `Course.duration` null; default unrecognized or missing durations to `1` (one semester) and log them rather than letting the planner guess.

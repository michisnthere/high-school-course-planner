# Course extractor prompt

You will be given a set of page images that contain one or more course detail entries. Produce a JSON object with the following keys: `departments` (empty list or department info if available), `courses` (list of course objects), `graduationRequirements` (empty list), `warnings` (list of strings).

Each course object must follow the finalized schema:
- `title`, `department`, `description`, `sourceReference`, `notes` (optional, omit if empty)
- For single-version courses: `creditType`, `credits`, `gpaWaiverOption`, and `offerings`
- For multi-version courses (e.g., Regular vs Online, Regular vs Early Bird, College Prep vs Accelerated): `choices` only, with no per-course `creditType`, `credits`, `gpaWaiverOption`, or `offerings`
- Each `choice` must be self-contained with: `name`, `isOnline`, `creditType`, `credits`, `gpaWaiverOption`, and `offerings`
- Each `offering` must contain only: `courseCode`, `semesterLabel`, `duration`, `gradeLevels`, `prerequisites` (keep as empty list if none), and optional `notes`
- `fulfillsRequirements` is a required top-level array on every course. List the exact graduation requirement names from `graduation_requirements.json` that the course satisfies; use an empty array if none. `creditType` must be only academic weighting (College Prep, Accelerated, Honors, AP) — never a requirement name like "Biological Science" or "Physical Science".
- `offerings` must NOT contain `creditType`, `credits`, or `corequisites`
- `isOnline` must only appear inside a `choice`, never at the course level
- `options` is no longer used; use `choices` for all alternate versions

Return only valid JSON.

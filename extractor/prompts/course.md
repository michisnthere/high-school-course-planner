# Course extractor prompt

You will be given a set of page images that contain one or more course detail entries. Produce a JSON object with the following keys: `departments` (empty list or department info if available), `courses` (list of course objects following the existing schema: title, department, description, offerings array with courseCode, semesterLabel, duration, gradeLevels, prerequisites, creditType, credits), `graduationRequirements` (empty list), `warnings` (list of strings).

Return only valid JSON.

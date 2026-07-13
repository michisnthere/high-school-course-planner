# Department extractor prompt

You will be given a set of page images that form a department overview section of a single course catalog. Produce a JSON object with the following keys: `departments` (list of {name, subdepartment (optional), description}), `courses` (empty list), `graduationRequirements` (empty list), `warnings` (list of strings).

Use concise, structured values. Follow the exact keys so downstream import works.

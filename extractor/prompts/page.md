# Page extraction prompt

You are given a single page image from a high school course catalog. Return only valid JSON with the following top-level keys:

- departments: list
- courses: list
- graduationRequirements: list
- warnings: list

The JSON must be a single object and contain exactly those keys.

If the page contains a department overview, populate departments and leave courses/graduationRequirements empty.
If the page contains course detail content, populate courses.
If the page contains graduation requirements, populate graduationRequirements.
If the page contains no extractable catalog data, return empty arrays for departments, courses, graduationRequirements, and a warning message.

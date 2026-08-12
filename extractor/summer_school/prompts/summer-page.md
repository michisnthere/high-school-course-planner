# Summer School page extraction prompt (Phase 2)

You are reading a single page image from the Adlai E. Stevenson High School
**Summer School coursebook** (Summer 2026). The page shows one or more Summer
School course listings, or it may be an informational page with no courses.

Your job is to return ONLY valid JSON matching the Summer School catalog schema
below. Do NOT add commentary, markdown, or prose outside the JSON.

Read the rendered coursebook page image directly. Extract only information
visibly supported by the page. Do not infer missing values from general
knowledge. Preserve exact course names, course codes, credits, grade
restrictions, sessions, prerequisites, corequisites, descriptions,
requirements, and notes. If a field cannot be established from the page, return
null/empty according to the schema and record an extraction issue rather than
guessing. Preserve distinctions between one-session and full-summer courses.
Preserve non-credit courses as `creditStatus = non-credit` with `credits =
null`. Do not create graduation requirements. Do not interpret catalog
categories such as Fine Arts, Applied Arts, CSET, etc. as graduation
requirements unless the page explicitly states that they are.

## Top-level shape

Return an object with exactly these keys:

- `sourceReference`: `{"file": "<pdf-name>", "page": <integer>}`
- `courses`: a list; MUST be `[]` if the page contains no course listings.
- `warnings`: a list of strings for page-level notes (e.g. "page is a cover /
  no courses", "text partially cut off").

## Per-course object

Use ONLY the following keys. OMIT a key when the page does not show the value.
Never guess, never infer from outside knowledge, never reuse values from a
previous page.

- `title` — REQUIRED string. Copy the course title EXACTLY as printed, including
  capitalization (e.g. "BUSINESS APPLICATIONS AND TECHNOLOGY 1").
- `key` — REQUIRED stable unique string you derive from the title and course
  code (lowercased, dashes), e.g. `"algebra-1"`, `"careers-in-business"`.
- `description` — string. Copy the course description as completely as it
  appears. Do NOT summarize, paraphrase, or invent sentences.
- `courseCode` — string. The printed Summer School course code(s), e.g.
  `"BUS71S"`. If two session codes are printed (e.g. "BUS71S" and "BUS72S"),
  join them with "/" (e.g. `"BUS71S/BUS72S"`). Omit if none printed.
- `credits` — number > 0. Preserve the printed credit value exactly, e.g.
  `0.5` for "0.5 Semester Credit", `1.0` for "1 Semester Credit". Omit if no
  credit value is printed.
- `creditStatus` - exactly `"credit"`, `"non-credit"`, or `"unknown"`. Use
  `"non-credit"` with `"credits": null` only when the page clearly identifies a
  non-credit course. Never use `0` credits.
- `division` / `department` - only if visibly printed on this page. Do not infer
  them from the title, code, or catalog section.
- `creditType` - only if visibly printed on this page.
- `gradeLevels` — list of integers in 9..12 parsed from "Open to: 9-10-11-12"
  → `[9, 10, 11, 12]`. Omit if not shown.
- `sessions` — list of Summer School session tokens taken from the printed
  session text: `["Session 1"]` when the course says "First semester only",
  `["Session 2"]` when it says "Second semester only", and
  `["Session 1", "Session 2"]` when it is offered in either/both semesters.
- `duration` — `"one_session"` for one-semester courses ("One-Semester Course"),
  or `"full_summer"` when the course explicitly requires or spans BOTH summer
  sessions (e.g. "BOTH SEMESTERS ARE REQUIRED FOR GRADE 9"). When both sessions
  are listed only as alternatives, use `"one_session"`.
- `prerequisites` — list of strings copied EXACTLY from the printed
  "Prerequisite:" / "Prerequisites:" text (e.g. `["Age 15 before the first day
  of summer school, parental consent, an instruction permit..."]`). Empty list
  `[]` when the page explicitly prints "Prerequisite: None". Omit if not shown.
- `corequisites` — list of strings if printed; omit otherwise.
- `fulfillsRequirements` — list of graduation requirement names the coursebook
  text EXPLICITLY associates with this course. Prefer to omit when the page does
  not mention a graduation requirement.
- `sourceReference` — `{"file": ..., "page": <this page number, from the
  prompt context, NOT your own guess>}`. The caller pins the page number.
- `extractionIssues` — REQUIRED array of objects
  `{"course", "page", "field", "status", "note"}`; add one entry for EVERY field
  you could not read confidently from the image. Allowed `status` values:
  `"unclear"`, `"missing"`, `"conflict"`.
- `notes` — optional list of strings for genuine extra facts printed on the
  page (e.g. cost, GPA waiver option, pass/fail, "Target student group").
  Do NOT use this to introduce invented content.

## Hard rules

1. Extract ONLY information visible in THIS page image. Do NOT use prior pages,
   the model's memory of schools, or any external source.
2. NEVER infer prerequisites, credits, grade levels, course equivalence, Summer
   School availability, or graduation requirements from outside knowledge. If a
   value is not readable from the image, OMIT it and add an `extractionIssues`
   entry with `status: "unclear"` (or `"missing"` if absent).
3. NEVER guess course codes or credits. Preserve them exactly as printed.
4. Do NOT merge, split, deduplicate, or "repair" courses. Return exactly what is
   on the page, one object per course listing.
5. If a course listing spans two columns or is continued, still produce ONE
   course object with the complete description.
6. Preserve exact titles, descriptions, codes, and text. Allowed cleanups are
   limited to fixing OCR-style mojibake (e.g. `â€™` -> `'`); do not change words.

## Empty / non-course pages

If the page has no course listings (cover, registration/policy page, index,
contact info), return:

```json
{
  "sourceReference": {"file": "SummerSchool2627.pdf", "page": <page>},
  "courses": [],
  "warnings": ["page contains no course listings"]
}
```

Do NOT force every page to contain a course.

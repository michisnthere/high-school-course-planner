# Four-Year Academic Roadmap Planner

## Phase 1: PDF Extraction and Academic Data Database

## Overview

The Four-Year Academic Roadmap Planner will eventually help students create and manage a personalized high school course plan. Phase 1 is intentionally narrower: it focuses only on turning a school coursebook PDF into structured academic data and storing that data in a database.

There is no frontend work in Phase 1. The first milestone is a reliable backend data foundation that later phases can use for search, planning, prerequisite validation, graduation tracking, and academic pathway guidance.

The coursebook PDF may contain more than course listings. It may also include graduation requirements, special requirement categories, waiver rules, and other academic policies. Phase 1 should extract and store that information too, not just individual courses.

## Phase 1 Goals

The goal of Phase 1 is to build a repeatable data pipeline that can:

- Accept a school-year coursebook PDF as the source document
- Extract raw text from the PDF
- Identify course information from the extracted text
- Identify graduation requirements and academic policy requirements from the extracted text
- Convert extracted information into structured JSON
- Validate the structured JSON before database import
- Store validated course and requirement data in PostgreSQL
- Represent courses, departments, credits, grade levels, prerequisites, and graduation requirements in the database
- Allow developers to inspect, correct, and re-run imports during development

## Phase 1 Scope

### Included

- PostgreSQL database setup
- Prisma schema for course catalog data
- Prisma schema for graduation requirement data
- PDF text extraction process
- AI-assisted parsing for courses and requirements
- Structured JSON output for extracted courses
- Structured JSON output for extracted graduation requirements
- Validation layer for extracted data
- Import script for loading validated JSON into the database
- Seed or sample data for development testing
- Developer documentation for running the extraction and import process

### Not Included

- Frontend application
- Course search page
- Course details page
- Student accounts
- Saved academic plans
- Four-year roadmap builder
- Drag-and-drop scheduling
- Graduation progress tracking UI
- Schedule conflict detection
- AI course recommendations
- Counselor or administrator dashboard
- Summer school course selection

These features belong to later phases after the school-year course data pipeline and database are working reliably.

## Technology Stack

### Backend and Data

| Technology | Purpose |
| --- | --- |
| Node.js | Runtime environment for scripts and tooling |
| TypeScript | Type safety and maintainability |
| PostgreSQL | Relational database for academic catalog data |
| Prisma | ORM and database schema management |
| PDF parsing library | Extract raw text from the coursebook PDF |
| AI extraction step | Convert inconsistent coursebook text into structured data |

### Infrastructure

| Technology | Purpose |
| --- | --- |
| Docker | Containerization |
| Docker Compose | Local database and development environment |

## Phase 1 Architecture

```text
+-----------------------+
| School-Year           |
| Coursebook PDF        |
+-----------+-----------+
            |
            v
+-----------------------+
| Text Extraction       |
+-----------+-----------+
            |
            v
+-----------------------+
| AI-Assisted Parsing   |
| Courses + Requirements|
+-----------+-----------+
            |
            v
+-----------------------+
| Structured JSON       |
| Courses + Rules       |
+-----------+-----------+
            |
            v
+-----------------------+
| Validation Layer      |
+-----------+-----------+
            |
            v
+-----------------------+
| Prisma Importer       |
+-----------+-----------+
            |
            v
+-----------------------+
| PostgreSQL            |
+-----------------------+
```

## Data Extraction Workflow

The school coursebook is expected to start as a PDF. Because PDF formatting can be inconsistent, Phase 1 will use a controlled extraction process that separates raw text extraction, AI-assisted parsing, validation, and database import.

### Workflow

1. Place the school-year coursebook PDF in the expected input location.
2. Extract raw text from the PDF.
3. Parse the extracted text into structured course records.
4. Parse graduation requirements and academic policy requirements into structured records.
5. Generate JSON containing extracted courses and requirements.
6. Validate the JSON for required fields, duplicate records, invalid credit values, and unclear prerequisite or requirement references.
7. Review and correct extracted data if needed.
8. Import the validated JSON into PostgreSQL using Prisma.
9. Confirm that courses, prerequisite relationships, graduation requirements, and requirement rules were stored correctly.

## Phase 1 Quickstart

1. Place the coursebook PDF in the project root.
2. Inspect page classification for pages 17, 18, and 22:
   ```bash
   python scripts/check_pages.py --pages 17 18 22
   ```
3. Extract raw text and page metadata from page 18:
   ```bash
   python scripts/extract_page.py --page 18
   ```
4. Run AI extraction only after setting `OPENAI_API_KEY` and passing `--ai`:
   ```bash
   export OPENAI_API_KEY=your_key_here
   python scripts/extract_page.py --page 18 --ai
   ```

Outputs are written to `data/raw-text`, `data/reports`, and `data/structured`.

## Extracted Course Fields

Each course record should include as many of the following fields as the coursebook provides. The coursebook may list one course title with separate semester-specific course codes, so the data model should allow a course to have one or more offerings.

- Department name, such as Business Education
- Department description or introductory text, when present
- Course title
- GPA waiver option status, when marked
- Course offerings or sections listed under the same title
- Course code for each offering, such as BUS171 or BUS172
- Semester label for each offering, such as Semester 1, Semester 2, or Semester 2 only
- Duration, such as one semester or full year
- Eligible grade levels or grade range, such as 9-10-11-12
- Prerequisites
- Co-requisites, if listed
- Credit category or credit type, such as College Prep
- Credit amount, if listed separately from credit category
- Course description
- Notes, restrictions, waiver language, or special labels
- Source page or source section reference when available

## Extracted Graduation Requirement Fields

Graduation requirements should be extracted separately from course records so later phases can calculate progress toward graduation. Examples may include civics and patriotism, driver's education, physical education, physical education waivers, economics, electives, and other school-specific requirements.

Each requirement record should include as many of the following fields as the coursebook provides:

- Requirement name
- Requirement category
- Required credits, units, semesters, or completion status
- Eligible courses that can satisfy the requirement
- Grade-level timing, if specified
- Waiver rules or exceptions
- Notes, restrictions, or policy language
- Source page or section reference when available

## Example Course JSON

```json
{
  "title": "Introduction to Business",
  "department": "Business Education",
  "departmentDescription": "Business education provides a foundation for students to develop skills for professional life.",
  "description": "Introduction to Business provides students with a foundational understanding of the business world.",
  "gpaWaiverOption": true,
  "offerings": [
    {
      "courseCode": "BUS171",
      "semesterLabel": "Semester 1",
      "duration": "One semester",
      "gradeLevels": [9, 10],
      "prerequisites": [],
      "corequisites": [],
      "creditType": "College Prep",
      "credits": null
    },
    {
      "courseCode": "BUS172",
      "semesterLabel": "Semester 2",
      "duration": "One semester",
      "gradeLevels": [9, 10],
      "prerequisites": [],
      "corequisites": [],
      "creditType": "College Prep",
      "credits": null
    }
  ],
  "notes": [],
  "sourceReference": "Business Education section"
}
```

## Example Graduation Requirement JSON

```json
{
  "name": "Physical Education",
  "category": "Graduation Requirement",
  "requirementType": "credits",
  "requiredValue": 2.0,
  "eligibleCourses": ["Physical Education 1", "Physical Education 2"],
  "waiverRules": [
    "Students may qualify for a waiver under approved school policy."
  ],
  "notes": [
    "Specific waiver details should be reviewed manually after extraction."
  ],
  "sourceReference": "Graduation Requirements section"
}
```

## Initial Database Design

Phase 1 needs the data required to store and maintain the school-year course catalog and graduation requirement rules. Planning-specific tables should wait until later phases.

### Course

```text
Course
------
id
title
departmentId
departmentDescription
description
gpaWaiverOption
notes
sourceReference
createdAt
updatedAt
```

### Course Offering

```text
CourseOffering
--------------
id
courseId
courseCode
semesterLabel
duration
gradeLevels
creditType
credits
createdAt
updatedAt
```

A course can have multiple offerings when the coursebook lists separate semester codes under one course title.

### Department

```text
Department
----------
id
name
createdAt
updatedAt
```

### Prerequisite

```text
Prerequisite
------------
id
courseId
requiredCourseId
note
createdAt
updatedAt
```

The `note` field can be used when a prerequisite is not a simple one-course requirement, such as "teacher recommendation required" or "completion of Algebra II or equivalent."

### Graduation Requirement

```text
GraduationRequirement
---------------------
id
name
category
requirementType
requiredValue
notes
sourceReference
createdAt
updatedAt
```

The `requirementType` field can represent different kinds of requirements, such as credits, semesters, completion, assessment, waiver, or policy-only requirements.

### Requirement Course

```text
RequirementCourse
-----------------
id
requirementId
courseId
note
createdAt
updatedAt
```

This table connects graduation requirements to courses that may satisfy them.

### Requirement Rule

```text
RequirementRule
---------------
id
requirementId
ruleType
description
createdAt
updatedAt
```

This table can store special rules, including waiver policies, grade-level restrictions, civics and patriotism rules, driver's education requirements, physical education exceptions, or elective category rules.

### Import Batch

```text
ImportBatch
-----------
id
sourceFileName
sourceType
status
startedAt
completedAt
summary
```

An import batch table is useful for tracking when course data or requirement data was imported and whether the import completed successfully. The `sourceType` field can distinguish school-year coursebook imports from future summer school coursebook imports.

## Validation Requirements

Before importing data into PostgreSQL, the validation step should check for:

- Missing course names
- Missing or duplicate course codes
- Invalid credit values
- Invalid grade levels
- Empty descriptions when the coursebook provides one
- Prerequisites that do not match known courses
- Duplicate course records
- Graduation requirements without names or categories
- Requirement values that cannot be interpreted
- Requirement-course links that do not match known courses
- Waiver or exception language that needs manual review
- Parsing errors or fields that need manual review

Validation should produce a clear report so extracted data can be corrected before import.

## Developer Commands

Exact commands may change as the project is implemented, but Phase 1 should eventually support commands similar to:

```bash
npm run db:migrate
npm run extract:pdf
npm run validate:academic-data
npm run import:academic-data
```

The important idea is that extraction, validation, and import should be separate steps. Keeping them separate makes it easier to inspect the data before it reaches the database.



## Course-Content Page Detection

The extraction process should not send every PDF page to the AI parser. It should first classify pages so token usage stays low and duplicate summary data is avoided.

Pages should be treated as:

- `detailed_course_content`: pages with full course entries, including fields such as course code, open-to grade levels, prerequisite, credit type, duration, GPA waiver option, and course description
- `course_listing_summary`: pages that mostly list course names and course codes, such as course offering overview pages
- `academic_policy_content`: pages with graduation requirements, waiver rules, civics and patriotism requirements, driver's education, physical education rules, economics, electives, or other policy text
- `front_matter_or_sparse_page`: cover pages, table-of-contents pages, section dividers, or pages with too little useful academic data
- `unknown_or_non_course_content`: pages that do not clearly match one of the above categories

During normal extraction, the AI step should process `detailed_course_content` and `academic_policy_content` pages. It should skip `course_listing_summary` pages such as pages 17 and 22 unless those pages are needed for a separate index or cross-checking workflow.

The current test script can classify pages without running AI:

```bash
python scripts/extract_first_page.py --check-pages 17 18 22
```

Expected behavior for the current coursebook:

```text
Page 17: course_listing_summary, skipped by default
Page 18: detailed_course_content, extracted by default
Page 22: course_listing_summary, skipped by default
```

## Course-Content Page Extraction Test

A small test script is available for checking extraction quality before processing the full coursebook.

```bash
python scripts/extract_first_page.py
```

By default, this extracts page 18 because the earlier pages are front matter, table-of-contents material, or other non-course pages in the current coursebook. Pages such as page 17 should be ignored during normal course extraction unless they contain graduation requirements or other academic policy data that needs to be captured separately.

The script writes reviewable files to:

```text
data/raw-text/page-018.txt
data/reports/page-018-ai-prompt.txt
```

To test a different course-content page, pass a page number:

```bash
python scripts/extract_first_page.py --page 19
```

To run the optional AI extraction step, set `OPENAI_API_KEY` and add `--ai`:

```bash
python scripts/extract_first_page.py --ai
```

The AI result will be saved to:

```text
data/structured/page-018.extracted.json
```

During quality testing, the script should process only one page at a time. Full-book extraction should start from the first actual course-content page and skip front matter pages that do not contain course, graduation requirement, or academic policy data.

## Local Development Setup

The Phase 1 development environment should include PostgreSQL and the backend tooling needed to run the extraction/import pipeline.

```bash
docker compose up --build
```

At minimum, the local environment should include:

1. PostgreSQL database
2. Prisma schema and migrations
3. PDF extraction script
4. Academic data JSON validation script
5. Database import script

## Phase 1 Success Criteria

Phase 1 is complete when:

- PostgreSQL is running locally through Docker Compose
- Prisma can connect to the database
- Course catalog tables are represented in the Prisma schema
- Graduation requirement tables are represented in the Prisma schema
- A school-year coursebook PDF can be converted into raw extracted text
- Extracted text can be converted into structured course JSON
- Extracted text can be converted into structured graduation requirement JSON
- Structured JSON can be validated before import
- Validated course records can be imported into PostgreSQL
- Validated graduation requirements can be imported into PostgreSQL
- Prerequisite relationships can be stored where the data is clear
- Requirement-course relationships can be stored where the data is clear
- Developers can re-run the extraction, validation, and import process without manually editing the database

## Later Phases

After Phase 1 is complete, the project can expand into:

- Phase 2: Course catalog frontend, course search, course details, and basic browsing experience
- Phase 3: Four-year planner, saved plans, drag-and-drop scheduling, and prerequisite validation
- Phase 4: Graduation tracking, pathway comparison, AI-assisted recommendations, and college preparation insights
- Phase 5: Summer school PDF extraction and summer course database import
- Phase 6: Summer school course selection foundation, including data models for student summer selections
- Phase 7: Summer school selection UI and workflow for choosing available summer courses
- Phase 8: Summer school selection validation, review, reporting, and integration with the broader academic plan

## README Organization

It is okay to have multiple README files. For this project, a useful structure could be:

```text
README.md
phases/
  phase-1-data-pipeline/README.md
  phase-2-course-catalog-ui/README.md
  phase-3-four-year-planner/README.md
  phase-4-graduation-and-recommendations/README.md
  phase-5-summer-school-data-pipeline/README.md
  phase-6-summer-selection-foundation/README.md
  phase-7-summer-selection-ui/README.md
  phase-8-summer-selection-validation/README.md
```

The root `README.md` can describe the overall project, while each phase README can describe the detailed goals, scope, setup, and success criteria for that specific phase.

## Project Status

Currently planning and defining Phase 1 requirements.




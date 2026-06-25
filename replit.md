# High School Course Planner

A data pipeline project for extracting, structuring, and importing high school course catalog data from a PDF coursebook into a PostgreSQL database.

## Project Overview

This project processes the Stevenson High School coursebook PDF (`Coursebook2026-27INTERACTIVE101725.pdf`) through two main pipelines:

1. **Python extraction pipeline** — Reads the PDF, classifies pages, and extracts structured course data using rule-based parsing (no AI required) or optional OpenAI-powered extraction.
2. **Node.js/Prisma import pipeline** — Takes the extracted JSON and imports it into PostgreSQL with a normalized Department → Subdepartment → Course → CourseOffering hierarchy.

## Tech Stack

- **Python 3.11** — PDF extraction and rule-based parsing scripts
- **Node.js 20 + TypeScript** — Prisma ORM and database import script
- **Prisma 6** — Database schema management and migrations
- **PostgreSQL** — Replit-managed database

## Database Schema

- `Department` — Top-level department (e.g. "Mathematics")
- `Subdepartment` — Sub-grouping within a department
- `Course` — Individual course with title, description, flags
- `CourseOffering` — Course code, grade levels, prerequisites, credits

## Key Commands

```bash
# Generate Prisma client
npm run prisma:generate

# Apply migrations
npm run prisma:migrate

# Import courses from extracted JSON into the database
npm run import:courses

# Run Python tests
python -m pytest tests/ -q

# Extract text from a specific PDF page
python scripts/check_pages.py --pages 18 19 20

# Rule-based extraction of the full book
python scripts/rule_extract_book.py

# Validate extraction output
python scripts/validate_extraction.py
```

## Data Flow

1. `data/extracted_courses.json` — AI/rule-extracted course data (input to import script)
2. `data/db_ready_courses.json` — Alternative structured format with departments
3. `scripts/import_courses.ts` — Reads `extracted_courses.json` and upserts into PostgreSQL

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (set automatically by Replit)
- `OPENAI_API_KEY` — Optional; only needed for AI-powered extraction scripts

## User Preferences

- This is a backend data pipeline with no web frontend.

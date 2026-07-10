# High School Course Planner

A high school course planning application with a Next.js frontend and an Express + Prisma + PostgreSQL backend. The project also includes a data pipeline for extracting course catalog data from the Stevenson High School coursebook PDF.

## Project Overview

This project has two parts:

1. **Web application** — Students can browse the course catalog, view course details, save courses, and plan their graduation requirements.
2. **Data pipeline** — Reads the coursebook PDF (`Coursebook2026-27INTERACTIVE101725.pdf`), classifies pages, and extracts structured course data using rule-based parsing (no AI required) or optional OpenAI-powered extraction. The cleaned data is imported into PostgreSQL via a Node.js/Prisma script.

## Tech Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 (inline styles only)
- **Backend:** Express + TypeScript + Prisma 6 + PostgreSQL
- **Authentication:** Passport + Google OAuth 2.0 + express-session
- **Data extraction:** Python 3.11

## Database Schema

- `Division` — Top-level academic division (e.g. "Mathematics")
- `Department` — Academic department within a division
- `Course` — Individual course with title, description, flags
- `CourseOption` — Choice group for a course (e.g. College Prep vs Accelerated variants)
- `CourseOffering` — Course code, grade levels, prerequisites, credits

## Key Commands

```bash
# Backend
npm run prisma:generate
npm run prisma:migrate
npm run import:courses
npm run dev            # Express backend on port 4000

# Frontend
npm run dev            # Next.js frontend on port 3000
npm run build
npm run start

# Python extraction pipeline
python -m pytest tests/ -q
python scripts/check_pages.py --pages 18 19 20
python scripts/rule_extract_book.py
python scripts/validate_extraction.py
```

## Authentication

- `/auth/google` — Starts the Google OAuth flow
- `/auth/google/callback` — Google redirects here; backend then redirects to the frontend
- `/auth/session` — Returns the current session status
- `/auth/logout` — Clears the session
- `/login` — Frontend page with the Google sign-in button
- `/profile` — Example page protected by the `ProtectedRoute` utility

The catalog and course detail pages (`/catalog`, `/catalog/[slug]`) remain public.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (set automatically by Replit)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (secret)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret (secret)
- `SESSION_SECRET` — Secret used to sign session cookies (secret)
- `FRONTEND_URL` — Frontend origin for OAuth redirects (defaults to `http://localhost:3000`)
- `OPENAI_API_KEY` — Optional; only needed for AI-powered extraction scripts

## User Preferences

- Keep the existing Next.js + Express architecture. Do not migrate the frontend to Vite and do not create a pnpm workspace.
- Use inline styles only; no UI component libraries.
- Preserve existing features: Dashboard, Course Catalog, Course Details, Search, Filters, and Saved Courses.
- Keep the authentication implementation modular so user accounts, saved-course syncing, and planner personalization can be added later without rewrites.

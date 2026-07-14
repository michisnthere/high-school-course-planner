# Catalog Import Pipeline Audit

## Purpose
This document captures findings from the audit of the course import pipeline
prior to migrating to the Neon PostgreSQL database. It identifies hardcoded
special-case logic that will NOT automatically update after a database reset.

## Source of Truth
- `backend/data/academic_data.json` — the single source of academic catalog data
- `backend/scripts/import_courses.ts` — the import pipeline
- Read by: `npx tsx scripts/import_courses.ts [path]`

## Recent Data Changes (applied 2026-07-14)
- **Driver Education** added: division=Physical Education, codes=DE231/DE232,
  1 credit, grades 10–12, fulfills "Driver Education"
- **American Studies** consolidated: single composite course instead of two
  split entries, fulfills both "English" and "U.S. History",
  codes=SOC581/SOC582/ENG341/ENG342, 2 credits, grade 11

## Behavioral Rules That ARE Data-Driven (survive reset)

| Rule | Location in academic_data.json |
|------|-------------------------------|
| American Studies fulfills English + U.S. History | `courses[].fulfillsRequirements` |
| American Studies course codes | `courses[].offerings[].courseCode` |
| American Studies prerequisites | `courses[].offerings[].prerequisites` |
| American Studies grade 11 only | `courses[].offerings[].gradeLevels` |
| Driver Education fulfills "Driver Education" | `courses[].fulfillsRequirements` |
| Driver Education course codes | `courses[].offerings[].courseCode` |
| Driver Education grades 10–12 | `courses[].offerings[].gradeLevels` |
| Driver Education prerequisites | `courses[].offerings[].prerequisites` |

## Behavioral Rules That Are HARDCODED (will NOT auto-update on reset)

### High priority — duplicates DB data or would silently break

1. **Backend `YEARLY_REQUIREMENTS`** (`backend/src/lib/plannerAnalysis.ts:652`)
   - Hardcodes which requirements apply per grade (9–12)
   - Grade 10 includes "Driver Education" with match terms
   - **Fix**: Derive from `GraduationRequirement` DB records (add `gradeLevel` column)

2. **Frontend `GRADE_REQUIREMENTS`** (`frontend/src/lib/gradeRequirements.ts:23`)
   - Duplicates the same year-level requirements client-side
   - **Fix**: Remove, read from backend analysis API instead

3. **Frontend `yearLevelValidation.ts`** (`frontend/src/lib/yearLevelValidation.ts`)
   - Hardcodes "Driver Education" check for grade 10
   - Hardcodes "foundational fitness" title matching for grade 9 PE
   - Hardcodes "Dance" string matching for PE fulfillment
   - **Fix**: Replace with data-driven approach (see item 4 below)

4. **`courseMatchesPeDanceDriverEd`** (`frontend/src/lib/gradeRequirements.ts:160`)
   - Hardcoded terms: `["Physical Education", "Dance", "Driver Education"]`
   - Does substring matching against title, fulfillsRequirements, department, division
   - **Fix**: Add `peEligible` boolean to CourseOffering or Course in Prisma schema

5. **`courseMatchesFreshmanFF`** (`frontend/src/lib/gradeRequirements.ts:184`)
   - Hardcodes `"foundational fitness"` substring match against course title
   - **Fix**: Mark the specific course in data with a boolean or tag

6. **`computePePerSemester`** (`frontend/src/lib/gradeRequirements.ts:188`)
   - Grade 9: semester 1 must be Freshman Foundational Fitness, semester 2 = PE/Dance/Driver Ed
   - Grades 10–12: any 2 semesters of PE/Dance/Driver Ed suffice
   - **Fix**: Make the PE semester rules data-driven

### Medium priority — translation/mapping layers

7. **`REQUIREMENT_NAME_ALIASES`** (`backend/src/lib/requirementsCleanup.ts:20`)
   - Maps source names to canonical names (e.g., "driver education" → "Driver Education")
   - Should remain as ETL translation layer but needs validation against DB

8. **`MEASURABLE_REQUIREMENT_NAMES`** (`backend/src/lib/requirementsCleanup.ts:80`)
   - Enumerates which requirement names are credit-tracked
   - **Fix**: Add `isMeasurable` boolean column to `GraduationRequirement`

9. **PE waiver canonical name check** (`backend/src/lib/plannerAnalysis.ts:447`)
   - Matches canonical name `"Physical Education"` exactly
   - Would break if canonical name changes

### Low priority — display labels

10. **PE section labels** (`frontend/src/components/planner/GradeRequirements.tsx:88,100`)
    - Hardcoded "Physical Welfare / Dance / Driver Education" and "Missing Freshman Foundational Fitness"
    - Display-only, no functional impact

11. **Marching Band keywords** (`frontend/src/lib/plannerWaivers.ts:31`)
    - Hardcoded list: ["freshman band", "wind ensemble", "symphonic band", "wind symphony", "color guard"]
    - Policy rule, unlikely to change

## Feature Gaps Not in Data or Code

| Gap | Impact |
|-----|--------|
| **American Studies double-period scheduling** — course needs 2 planner slots per semester | Planner cannot correctly schedule American Studies; no `slotsPerSemester` field exists on Course or CourseOffering |
| **No `peEligible` field** — PE eligibility inferred from text matching | Fragile; would fail if course titles or requirement names change |
| **No `gradeLevel` on GraduationRequirement** — yearly requirements hardcoded | Cannot be DB-driven without this field |
| **No `isMeasurable` on GraduationRequirement** — must enumerate in code | Cannot be DB-driven without this field |

## Migration Workflow (safe for fresh DB)

```bash
# 1. Apply Prisma migrations
cd backend
npx prisma migrate deploy

# 2. Import catalog data
npx tsx scripts/import_courses.ts data/academic_data.json

# The import only touches: Division, Department, Course, CourseOption,
# CourseOffering, GraduationRequirement, CourseRequirement.
# Student data (User, Planner, CompletedCourse, etc.) is NOT touched.
```

## Scripts That Must NOT Be Re-run After Reset

These scripts contain hardcoded DB record IDs that will not match
auto-generated IDs in a fresh database:

| Script | Reason |
|--------|--------|
| `backend/scripts/migrate_requirements.ts` | Contains hardcoded requirement IDs (3, 9, 31, etc.) |
| `backend/scripts/restore_and_sync_requirements.ts` | Contains hardcoded requirement IDs mapped to specific numbers |

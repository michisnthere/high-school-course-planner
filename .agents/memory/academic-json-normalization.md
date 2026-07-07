---
name: Academic JSON normalization
description: Rules and scope boundaries for cleaning the extracted academic JSON vs. the DB import feed.
---

# Academic JSON normalization

The extractor emits two related JSON shapes:

- **Extractor JSON** (`extractor/page_output/*.json`, `extractor/section_output/*.json`, `extractor/output/academic-data.json`) — the canonical academic-data format.
- **DB import feed** (`data/extracted_courses.json`, `data/db_ready_courses.json`) — flattened format consumed by `scripts/import_courses.ts`.

## Rule set applied to extractor JSON

- Default credit is `1.0` unless the course description explicitly says `1.5 period`.
- Only keep `choices` when a course has multiple student-selectable versions; collapse single-choice courses onto the parent.
- No `isOnline` on the parent course; put it on each choice.
- No `corequisites` field anywhere; empty arrays are removed, and the normalizer aborts if any non-empty `corequisites` are found.
- `notes` and `prerequisites` are always arrays, never null; prerequisites are deduplicated.
- `gradeLevels` are sorted ascending integers.
- `duration` is normalized to `Full Year` or `One Semester`; `semesterLabel` to `Semester 1` or `Semester 2`.
- Stray continuation-note courses (e.g., "Life by Design — continued note") are merged into the preceding real course.

## Scope boundary

The DB import feed was intentionally left in the old flat format. Normalizing it (e.g., grouping versions into `choices`, removing top-level `isOnline`) would break `scripts/import_courses.ts` and the Prisma schema, which expect flat courses and `course.isOnline`.

**Why:** The extractor JSON is the source of truth for the cleaned catalog; the DB feed is a separate downstream artifact that needs its own import-pipeline update before it can be re-shaped.

## How to apply

- Run `python scripts/normalize_academic_json.py` to re-normalize the extractor JSON. It is idempotent and pre-scans for unsafe corequisites.
- After changing the DB import pipeline to handle choices/online-per-choice, revisit whether to normalize `data/extracted_courses.json` as well.

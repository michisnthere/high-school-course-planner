---
name: Academic JSON normalization
description: Boundaries and rules for keeping academic weighting, graduation requirements, and the DB import feed separate.
---

# Academic JSON normalization

## Weight vs. graduation requirements

- `creditType` represents only academic weighting (`College Prep`, `Accelerated`, `Honors`, `AP`) or no weight (`null`).
- `fulfillsRequirements` is a required top-level array of exact graduation requirement names that a course satisfies.
- Legacy printed `creditType` strings may embed requirement names (e.g., "College Prep Biological Science"). These must be split: the weight stays in `creditType`, the requirement names go into `fulfillsRequirements`.

**Why:** The original schema conflated academic weighting with graduation requirement categories, making it impossible to tell which courses fulfilled which requirements without parsing free-form strings.

**How to apply:** When normalizing raw/extracted catalog data, tokenize the printed `creditType` for known weights and requirement phrases, then put each piece in its own field. Validate that `creditType` is a known weight or null.

## Requirement names come from a single source of truth

- Requirement tags must match the exact names in the canonical graduation requirements file. Do not invent alternate spellings.
- Department-level defaults are safe fallbacks only for uniformly mapped departments (e.g., Mathematics, English, Visual/Music/Theatre/Dance, Physical Education, Health Education, Driver Education).
- Course titles are a reliable signal for specific requirements like "U.S. History", "World History and Geography", "Government", "Economics or Personal Finance", etc.
- Free-form descriptions are too noisy for generic term matching; a description that says "health-related" must not tag a course as Health.

**Why:** Using exact, canonical names keeps the catalog aligned with the official graduation requirements, and title-based signals avoid false positives from descriptive text.

## Explicit "does not satisfy" statements override positive signals

- If the catalog text says a course "does not satisfy the ... graduation requirement", remove the corresponding requirement from `fulfillsRequirements` even if other signals (title, creditType) suggest it.

**Why:** Catalog text is the authoritative source; a course can share a name or topic with a requirement without actually fulfilling it.

## DB import feed tracks the canonical academic JSON

- The canonical extracted catalog JSON is the single source of truth for the importer. It carries `CourseOption` choice groups and a per-choice `isOnline` flag, and the importer consumes it directly using the Division → Department → Course → CourseOption → CourseOffering hierarchy.
- Legacy flat feeds that predate the choice-group model are no longer consumed by the importer and should be treated as historical artifacts.

**Why:** Maintaining a separate flattened feed duplicates data and loses choice-group semantics; the importer should read the canonical catalog JSON directly.

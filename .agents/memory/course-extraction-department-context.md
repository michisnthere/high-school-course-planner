---
name: Course extraction department context
description: How department attribution works across pages in the Python rule-based course extraction pipeline, and the safe way to carry it forward.
---

The per-page rule-based extractor (src/rules/parse_courses.py, driven by scripts/rule_extract_book.py)
originally derived department **independently per page**: detect a header on that page, else fall back
to a static course-code-prefix table, else null. It had no memory across pages, so a section whose
department header only appears once (on the first page) but continues onto a following page with no
repeated header produced orphaned (null-department) courses on the continuation page.

**Why this matters:** naive fixes that just "carry the previous page's department forward" are unsafe —
if the following page is actually a *new, unlabeled* section (different course-code prefix family) rather
than a continuation, blind carry-forward silently mislabels it with the wrong department, which is worse
than leaving it null.

**How to apply:** an `ExtractionContext` persists `current_department` plus an empirically-built
`prefix_department_map` (which course-code prefixes have actually been observed under which department
name via a real header hit). A header-less page only inherits the carried department if its course-code
prefixes are a subset of what's already been confirmed for that department (or if there's no recorded
prefix history for it yet). Otherwise it falls through to the static prefix heuristic, and if that also
fails, the department stays null with an explicit "Missing department context" warning instead of a
silent/guessed value. Extending the static fallback table with a fabricated department name for a prefix
that never has an explicit header anywhere in the source is not a good option — better to warn than invent.

Also: the source PDF (`Coursebook2026-27INTERACTIVE101725.pdf`) is not guaranteed to be present in every
session's workspace — check before assuming `scripts/rule_extract_book.py` can be re-run end-to-end;
fall back to targeted pytest fixtures under `tests/fixtures/` to validate extraction-logic changes.

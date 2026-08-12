---
name: AP/Honors credit type split
description: How the shared Credit Type filter and course badges treat AP vs Honors given that the catalog stores all AP courses with creditType "Honors".
---

The catalog never stored a literal `AP` (or `AP/Honors`) `creditType` value. Every rigorous course is stored as `creditType: "Honors"`, and the AP designation only exists in the course title prefix (e.g. `AP Biology`, `AP Calculus AB`). Verified against the live Neon DB: served `creditType` values are only `Accelerated`, `College Prep`, and `Honors`.

**Representation chosen:** the frontend derives an effective credit type via `effectiveCreditType(title, creditType)` in `frontend/src/lib/catalog.ts`. A course reads as `AP` when its title starts with `AP ` (`^AP\s`, 34 courses, zero false positives) and its stored credit type is Honors/AP; otherwise the raw credit type is used. This splits the collapsed "AP/Honors" bucket into independent `AP` and `Honors` labels/filters without changing extraction data.

**Filter semantics (regular coursebook):**
- `AP` selected → courses whose *effective* credit type is `AP`.
- `Honors` selected → courses whose *effective* credit type is `Honors`.
- Both → union. Neither → no credit-type restriction.
- There is no combined `AP/Honors` option.

The Summer School filter and the Add-Course modal were verified not to expose an AP/Honors credit-type filter (`CoursePicker` passes `creditTypes={[]}`; summer uses credit statuses), so no split was needed there. `formatCreditType(value, courseTitle)` no longer emits "AP/Honors"; badge call sites pass the course title so AP courses badge as `AP`.
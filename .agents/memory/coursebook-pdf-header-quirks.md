---
name: Coursebook PDF header quirks
description: Non-obvious text quirks in the Stevenson coursebook PDF extraction source that affect department/header detection.
---

## Page-number digits glue onto header words
PDF text extraction sometimes yields section headers with the trailing page
number stuck directly onto the last word, with no space (e.g.
`"FINE ARTS—MEDIA ARTS48"`, `"MUL TILINGUAL LEARNING 69"`). A course-code
regex like `[A-Z]{2,5}\d{2,3}` can accidentally match the glued digits
(`"ARTS48"` looks like a course code), causing a real single-line department
header to be misclassified as course content and skipped entirely.

**Why:** this caused a real regression — once cross-page department
carry-forward was added, pages whose own (real) header was misdetected this
way silently inherited the *previous* page's more specific department
instead of falling back to a generic/no-op state, corrupting otherwise-correct
subdepartment attribution (e.g. Photography wrongly inherited "Visual Arts"
from the preceding page instead of its own "Media Arts" header).

**How to apply:** when checking whether a short, single-line block "looks
like a department header," strip trailing digits from the text *before*
running any course-code-candidate check on it, not after. Checking header-ness
only after already having ruled out course-code-likeness is the wrong order
for glued page numbers.

## Some real department names only appear on a division-intro page
Not every course-listing page repeats its department name near the course
content. E.g. "English Language Development" (a real department, confirmed
via a "MULTILINGUAL LEARNING DIVISION" intro page listing it as a sub-department)
never appears as a clean header on the actual ELD course-listing pages —
those pages jump straight into a course summary/index followed by detailed
entries, with the department name embedded only inside a header line deep in
the page which the given passes never reach, plus a division-intro page many
pages earlier.

**Why:** naively hardcoding this real-but-non-adjacent name as a static
prefix→department fallback works textually, but the JSON pipeline's TS
normalization layer keeps a hard-coded set of standardized department names.
Introducing a new raw department string not already in that map would either
create an unmapped/non-standard department downstream or require touching
the (out-of-scope) normalization file to add a mapping entry.

**How to apply:** when a fix's scope is explicitly limited to the extraction
side only (no normalization/schema changes allowed), and a department name
requires normalization awareness to introduce safely, it is more correct to
leave the record with no department + a clear warning than to fabricate/extend
coverage that would silently require an out-of-scope change elsewhere.

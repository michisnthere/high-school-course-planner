"""Summer School catalog extraction and import framework.

Phase 1 (this task) provides the *framework only*:

    PDF (SummerSchool2627.pdf)
      -> PNG pages
      -> per-page vision extraction (stub interface)
      -> combined Summer School catalog JSON
      -> schema validation
      -> regular-course matching
      -> dry-run import report (no database writes)

No course content is extracted or inferred in Phase 1.  The pipeline is designed
to be reviewable at every stage so that Phase 2 can render pages to PNGs and run
the visual extraction without requiring code changes to this framework.
"""
from __future__ import annotations

SCHEMA_VERSION = "summer-school-catalog/v1"
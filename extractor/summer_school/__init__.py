"""Summer School catalog extraction framework.

    PDF (SummerSchool2627.pdf)
      -> images/ (300-DPI rendered PNGs; the source of truth)
      -> extracted/ (one agent-transcribed JSON per page; a coding agent reads
         the PNGs directly -- no OCR, PDF text, or vision client)
      -> combined Summer School catalog JSON
      -> schema validation
      -> regular-course matching
      -> dry-run import report (no database writes)

The extraction stage is the reusable agent workflow in ``agent_png_extraction.py``
(contract in ``prompts/summer-page.md``).  Nothing in this package writes to the
database; a separate import stage consumes the "ready" catalog.
"""
from __future__ import annotations

SCHEMA_VERSION = "summer-school-catalog/v1"
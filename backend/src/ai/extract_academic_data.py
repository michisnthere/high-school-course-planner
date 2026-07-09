import json
import os
import urllib.error
import urllib.request
from typing import Any


def build_academic_extraction_prompt(page_number: int, text: str) -> str:
    return f"""
You are extracting structured academic data from a single page of a high school coursebook.
Return only valid JSON that conforms to the finalized schema. Do NOT call external APIs.

Important extraction rules (do not summarize):
- Copy course descriptions and department descriptions as completely as they appear on the page.
- Do NOT shorten, paraphrase, or summarize descriptions. Preserve all sentences and punctuation.
- Minor OCR fixes are allowed only to restore broken words (e.g., "so/f_tware" -> "software")
  but do not change meaning or remove whole clauses.
- Store courses only in the top-level "courses" array. Do NOT nest course arrays inside departments.
- Department records should include only `name` and `description` (full available text).
- `choices` is the ONLY abstraction for alternate versions of a course (e.g., Regular vs Online,
  Regular vs Early Bird, College Prep vs Accelerated). Do NOT use `options`.
- For single-version courses, put `creditType`, `credits`, and `gpaWaiverOption` directly on the
  course object.
- For multi-version courses, put `creditType`, `credits`, `gpaWaiverOption`, and `isOnline` inside
  each `choice` object.
- `isOnline` must never appear at the course level. It belongs inside a choice.
- `offerings` contain only semester-specific scheduling data: `courseCode`, `semesterLabel`,
  `duration`, `gradeLevels`, `prerequisites`, and optional `notes`.
- `offerings` must NEVER contain `creditType`, `credits`, or `corequisites`.
- `corequisites` are no longer part of the schema; do not emit them.
- `notes` should be omitted entirely when they would be empty.
- `prerequisites` must always be a list (keep it empty if there are none).
- `fulfillsRequirements` is a required top-level array on every course. List the exact
  graduation requirement names from `graduation_requirements.json` that the course
  satisfies. Use an empty array if none.
- `creditType` must represent only academic weighting (College Prep, Accelerated,
  Honors, AP). Do not embed requirement names like "Biological Science" or
  "Physical Science" in `creditType`; put those in `fulfillsRequirements`.
- `gradeLevels` should be a list of integers parsed from ranges like "9-10-11-12".
- When uncertain about a parsed field, include a concise entry in the top-level `warnings` array
  describing the uncertainty and which course it affects.

Credit handling rules:
- If a numeric credit amount is explicitly printed on the page, use that value.
- If no numeric credit is printed, set `credits` to 1.0 by default and add a warning that
  the credit was inferred rather than printed.
- If the description explicitly states a lab period like "1.5 period lab-based" or contains
  the phrase "1.5 period" or "1.5-period", set `credits` to 1.5.
- `creditType` must be only the academic weight. If the printed credit type contains a
  requirement name (e.g. "College Prep Biological Science"), record the weight as
  "College Prep" and put the requirement name in `fulfillsRequirements`.

Text cleanup rules (allowed automatic fixes):
- Normalize common PDF mojibake and typographic artifacts: replace sequences like
  `â€™` and the Unicode right single quotation `’` with the ASCII apostrophe `'.
- Replace common ligatures or broken characters (for example `ﬀ` -> `ff`).
- Fix obvious broken words caused by OCR (for example `so/f_tware` -> `software`).
- Do not change sentence meaning or remove clauses; these fixes should only restore
  readable characters and words.

Credit type normalization:
- Normalize printed creditType values to one of the academic weights: College Prep,
  Accelerated, Honors, or AP. If the printed value contains a requirement name (e.g.,
  "College Prep Biological Science"), put the requirement in `fulfillsRequirements` and
  keep only the weight in `creditType`.
- Do not invent or change other policy text.

Return JSON using this shape (match `src/schemas/academic_data.py`):
{{
  "sourcePage": {page_number},
  "departments": [
    {{
      "name": "string or null",
      "description": "string or null"
    }}
  ],
  "courses": [
    {{
      "title": "string",
      "department": "string or null",
      "description": "string or null",
      "creditType": "string or null",
      "credits": 1.0,
      "gpaWaiverOption": false,
      "fulfillsRequirements": [],
      "offerings": [
        {{
          "courseCode": "string or null",
          "semesterLabel": "string or null",
          "duration": "string or null",
          "gradeLevels": [9, 10, 11, 12],
          "prerequisites": ["string"]
        }}
      ],
      "notes": ["string"],
      "sourceReference": "string or null"
    }}
  ],
  "graduationRequirements": [],
  "warnings": ["string"]
}}

For courses with multiple versions, use this choice shape instead of per-course credit fields:
{{
  "title": "string",
  "department": "string or null",
  "description": "string or null",
  "choices": [
    {{
      "name": "string",
      "isOnline": false,
      "creditType": "string or null",
      "credits": 1.0,
      "gpaWaiverOption": false,
      "offerings": [{{ ...same offering shape as above... }}]
    }}
  ],
  "fulfillsRequirements": [],
  "notes": ["string"],
  "sourceReference": "string or null"
}}

Page text (preserve exactly when extracting descriptions; you may perform minor OCR fixes):
{text}
""".strip()


def call_openai(model: str, prompt: str) -> Any:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Set it to run with --ai.")

    payload = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt,
                    }
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_object",
            }
        },
    }

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI request failed: {exc.code} {body}") from exc

    output_text = result.get("output_text")
    if not output_text:
        parts = []
        for item in result.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in {"output_text", "text"}:
                    parts.append(content.get("text", ""))
        output_text = "".join(parts)

    if not output_text:
        raise RuntimeError("OpenAI response did not contain output_text.")

    return json.loads(output_text)

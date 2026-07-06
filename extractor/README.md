Image-first extraction scaffold

This `extractor/` folder provides a minimal, explicit scaffold for an image-first
pipeline that renders PDF pages to PNGs, groups them by `config/sections.json`,
sends sections to a vision client, and writes one JSON file per section into `output/`.

Notes:
- The current `vision_client` is a local stub. Replace `vision_client.get_client()` with
  an adapter for OpenAI/Google/Anthropic when ready.
- The pipeline is intentionally simple and synchronous to make iteration and debugging easy.

How to run (basic):

1. Ensure page images exist under `extractor/images/page-0001.png` etc., or install
   `pdf2image` and `poppler` and provide the PDF path in `config/sections.json`.

2. Run:

```
python extractor/run_pipeline.py path/to/coursebook.pdf
```

3. Per-section JSON files are written to `extractor/output/` and combined into
   `extractor/output/academic-data.json`.

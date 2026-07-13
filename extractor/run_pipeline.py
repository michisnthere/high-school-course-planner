"""Simple, page-local image-first extraction pipeline.

Pipeline steps:
- render every PDF page into extractor/images/page_XXX.png
- load extractor/config/sections.json
- for each section, process every page image through the vision client
- write one JSON file per page into extractor/page_output/
- combine page JSON files into extractor/section_output/<section_id>.json
- combine section JSON files into extractor/output/academic-data.json
"""
from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List

import page_renderer
from page_renderer import render_pdf_to_pngs
from extract_page import extract_page, write_page_json
from combine_pages import combine_pages
from combine_sections import combine_sections

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config", "sections.json")
IMAGE_DIR = os.path.join(os.path.dirname(__file__), "images")
PAGE_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "page_output")
SECTION_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "section_output")
FINAL_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def load_config(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def normalize_section_pages(section: Dict[str, Any]) -> List[int]:
    pages = section.get("pages")
    if isinstance(pages, list) and pages:
        return sorted(int(p) for p in pages)
    start_page = section.get("start_page")
    end_page = section.get("end_page")
    if isinstance(start_page, int) and isinstance(end_page, int):
        return list(range(start_page, end_page + 1))
    return []


def verify_images_exist(pages: List[int]) -> None:
    missing = []
    for page in pages:
        image_path = os.path.join(IMAGE_DIR, f"page_{page:03d}.png")
        if not os.path.exists(image_path):
            missing.append(image_path)
    if missing:
        raise FileNotFoundError(
            "Missing rendered page images: " + ", ".join(missing)
        )


def gather_page_images(page_numbers: List[int]) -> List[str]:
    return [os.path.join(IMAGE_DIR, f"page_{page:03d}.png") for page in page_numbers]


def ensure_directories() -> None:
    for path in [IMAGE_DIR, PAGE_OUTPUT_DIR, SECTION_OUTPUT_DIR, FINAL_OUTPUT_DIR]:
        os.makedirs(path, exist_ok=True)


def main(pdf_path: str | None = None) -> None:
    ensure_directories()
    config = load_config(CONFIG_PATH)
    pdf_path = pdf_path or config.get("pdf")
    if not pdf_path:
        print("PDF path must be supplied either in command line or in config/sections.json")
        sys.exit(1)
        
    if not os.listdir(IMAGE_DIR):
        print("Rendering PDF to PNGs...")
        render_pdf_to_pngs(pdf_path, IMAGE_DIR, dpi=300)
    else:
        print("Using existing rendered PNGs.")

    # Verify all referenced images exist before processing any pages.
    all_page_numbers = []
    for section in config.get("sections", []):
        all_page_numbers.extend(normalize_section_pages(section))
    verify_images_exist(sorted(set(all_page_numbers)))

    sections = config.get("sections", [])
    section_files: List[str] = []

    for section in sections:
        section_id = section.get("id")
        section_type = section.get("type")
        page_numbers = normalize_section_pages(section)
        if not page_numbers:
            print(f"Skipping section {section_id}: no page list found.")
            continue

        verify_images_exist(page_numbers)
        page_paths = gather_page_images(page_numbers)

        for page_number, page_path in zip(page_numbers, page_paths):
            page_json = extract_page(page_path, section_type, section_id)
            write_page_json(page_number, page_json, PAGE_OUTPUT_DIR)

        section_file = combine_pages(section_id, page_numbers, PAGE_OUTPUT_DIR, SECTION_OUTPUT_DIR)
        section_files.append(section_file)
        print(f"Wrote section JSON {section_file}")

    final_path = combine_sections(SECTION_OUTPUT_DIR, FINAL_OUTPUT_DIR)
    print(f"Final academic catalog written to {final_path}")


if __name__ == "__main__":
    main(None if len(sys.argv) < 2 else sys.argv[1])

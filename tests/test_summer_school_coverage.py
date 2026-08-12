"""Tests for the Summer School extraction pipeline coverage hardening.

Verifies that verify_exact_coverage() correctly detects:
  - exact page-set match (success)
  - missing extracted JSONs (PNG without JSON)
  - orphaned extracted JSONs (JSON without PNG)

All tests use temporary directories and never touch the real images/ or
extracted/ directories.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest

from extractor.summer_school.agent_png_extraction import (
    verify_coverage,
    verify_exact_coverage,
    _extracted_page_numbers,
)


def _make_png(directory: Path, page_number: int) -> Path:
    """Create a minimal PNG-like file for testing (1x1 pixel PNG header)."""
    path = directory / f"page_{page_number:03d}.png"
    # Minimal valid PNG: 8-byte signature + IHDR chunk + IEND
    # We just need the file to exist with the right name; content is irrelevant.
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"  # PNG signature
        b"\x00\x00\x00\rIHDR"  # IHDR chunk start
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx"
        b"\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return path


def _make_page_json(directory: Path, page_number: int) -> Path:
    """Create a minimal extracted page JSON for testing."""
    path = directory / f"page_{page_number:03d}.json"
    data = {
        "sourceReference": {"file": "SummerSchool2627.pdf", "page": page_number},
        "sourcePage": page_number,
        "sourceImage": f"images/page_{page_number:03d}.png",
        "courses": [],
        "warnings": ["page contains no course listings"],
    }
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return path


class TestVerifyExactCoverage:
    """Tests for verify_exact_coverage()."""

    def test_exact_match_returns_empty_lists(self):
        """When PNG and JSON sets match exactly, both lists are empty."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            for page in [1, 2, 3, 4, 5]:
                _make_png(img_dir, page)
                _make_page_json(ext_dir, page)

            missing, orphaned = verify_exact_coverage(
                image_dir=img_dir, extracted_dir=ext_dir
            )
            assert missing == []
            assert orphaned == []

    def test_missing_json_detected(self):
        """PNG exists but JSON does not → missing list contains that page."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            for page in [1, 2, 3]:
                _make_png(img_dir, page)
            # Only create JSON for pages 1 and 2, not 3
            _make_page_json(ext_dir, 1)
            _make_page_json(ext_dir, 2)

            missing, orphaned = verify_exact_coverage(
                image_dir=img_dir, extracted_dir=ext_dir
            )
            assert missing == [3]
            assert orphaned == []

    def test_orphaned_json_detected(self):
        """JSON exists but PNG does not → orphaned list contains that page."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            # PNGs for pages 1 and 2 only
            _make_png(img_dir, 1)
            _make_png(img_dir, 2)
            # JSONs for pages 1, 2, and 3 (3 is orphaned)
            _make_page_json(ext_dir, 1)
            _make_page_json(ext_dir, 2)
            _make_page_json(ext_dir, 3)

            missing, orphaned = verify_exact_coverage(
                image_dir=img_dir, extracted_dir=ext_dir
            )
            assert missing == []
            assert orphaned == [3]

    def test_both_missing_and_orphaned(self):
        """Both missing and orphaned pages detected simultaneously."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            # PNGs for pages 1, 2, 3
            for page in [1, 2, 3]:
                _make_png(img_dir, page)
            # JSONs for pages 2, 3, 4 (1 is missing, 4 is orphaned)
            _make_page_json(ext_dir, 2)
            _make_page_json(ext_dir, 3)
            _make_page_json(ext_dir, 4)

            missing, orphaned = verify_exact_coverage(
                image_dir=img_dir, extracted_dir=ext_dir
            )
            assert missing == [1]
            assert orphaned == [4]

    def test_empty_directories(self):
        """Both empty → exact match (no pages at all)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            missing, orphaned = verify_exact_coverage(
                image_dir=img_dir, extracted_dir=ext_dir
            )
            assert missing == []
            assert orphaned == []

    def test_multiple_missing_pages(self):
        """Multiple missing pages are all detected and sorted."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            for page in range(1, 8):
                _make_png(img_dir, page)
            # Only pages 2 and 5 have JSONs
            _make_page_json(ext_dir, 2)
            _make_page_json(ext_dir, 5)

            missing, orphaned = verify_exact_coverage(
                image_dir=img_dir, extracted_dir=ext_dir
            )
            assert missing == [1, 3, 4, 6, 7]
            assert orphaned == []

    def test_multiple_orphaned_pages(self):
        """Multiple orphaned pages are all detected and sorted."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            # PNGs for pages 1, 2
            _make_png(img_dir, 1)
            _make_png(img_dir, 2)
            # JSONs for pages 1, 2, 5, 6, 7
            for page in [1, 2, 5, 6, 7]:
                _make_page_json(ext_dir, page)

            missing, orphaned = verify_exact_coverage(
                image_dir=img_dir, extracted_dir=ext_dir
            )
            assert missing == []
            assert orphaned == [5, 6, 7]


class TestVerifyCoverageBackwardCompatibility:
    """Tests that verify_coverage() (legacy) still works correctly."""

    def test_returns_missing_pages_only(self):
        """verify_coverage() returns only missing page numbers (no orphans)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            for page in [1, 2, 3, 4, 5]:
                _make_png(img_dir, page)
            # Pages 1 and 3 have JSONs
            _make_page_json(ext_dir, 1)
            _make_page_json(ext_dir, 3)

            missing = verify_coverage(image_dir=img_dir, extracted_dir=ext_dir)
            assert sorted(missing) == [2, 4, 5]

    def test_empty_when_all_present(self):
        """verify_coverage() returns empty list when all pages have JSONs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            for page in [1, 2, 3]:
                _make_png(img_dir, page)
                _make_page_json(ext_dir, page)

            missing = verify_coverage(image_dir=img_dir, extracted_dir=ext_dir)
            assert missing == []


class TestExtractedPageNumbers:
    """Tests for _extracted_page_numbers()."""

    def test_parses_page_numbers_from_filenames(self):
        """Correctly extracts page numbers from page_NNN.json filenames."""
        with tempfile.TemporaryDirectory() as tmpdir:
            ext_dir = Path(tmpdir)
            for page in [1, 5, 10, 20]:
                _make_page_json(ext_dir, page)

            numbers = _extracted_page_numbers(ext_dir)
            assert numbers == {1, 5, 10, 20}

    def test_ignores_non_matching_files(self):
        """Files that don't match page_NNN.json are ignored."""
        with tempfile.TemporaryDirectory() as tmpdir:
            ext_dir = Path(tmpdir)
            _make_page_json(ext_dir, 1)
            # Non-matching files
            (ext_dir / "not_a_page.json").write_text("{}", encoding="utf-8")
            (ext_dir / "page_abc.json").write_text("{}", encoding="utf-8")
            (ext_dir / "readme.txt").write_text("hello", encoding="utf-8")

            numbers = _extracted_page_numbers(ext_dir)
            assert numbers == {1}

    def test_empty_directory(self):
        """Empty directory returns empty set."""
        with tempfile.TemporaryDirectory() as tmpdir:
            ext_dir = Path(tmpdir)
            numbers = _extracted_page_numbers(ext_dir)
            assert numbers == set()


class TestFinalizeRefusesStaleData:
    """Tests that finalize() refuses to proceed with missing or orphaned pages."""

    def test_finalize_raises_on_missing_pages(self):
        """finalize() raises SystemExit when pages are missing JSONs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            for page in [1, 2, 3]:
                _make_png(img_dir, page)
            # Only page 1 has JSON
            _make_page_json(ext_dir, 1)

            from extractor.summer_school.agent_png_extraction import finalize
            with pytest.raises(SystemExit, match="Missing extracted JSONs"):
                finalize(extracted_dir=ext_dir, image_dir=img_dir)

    def test_finalize_raises_on_orphaned_pages(self):
        """finalize() raises SystemExit when orphaned JSONs exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            # PNGs for pages 1, 2
            _make_png(img_dir, 1)
            _make_png(img_dir, 2)
            # JSONs for pages 1, 2, 3 (3 is orphaned)
            _make_page_json(ext_dir, 1)
            _make_page_json(ext_dir, 2)
            _make_page_json(ext_dir, 3)

            from extractor.summer_school.agent_png_extraction import finalize
            with pytest.raises(SystemExit, match="Orphaned extracted JSONs"):
                finalize(extracted_dir=ext_dir, image_dir=img_dir)

    def test_finalize_raises_on_both_missing_and_orphaned(self):
        """finalize() raises with both missing and orphaned in the error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            # PNGs for pages 1, 2, 3
            for page in [1, 2, 3]:
                _make_png(img_dir, page)
            # JSONs for pages 2, 3, 4 (1 missing, 4 orphaned)
            _make_page_json(ext_dir, 2)
            _make_page_json(ext_dir, 3)
            _make_page_json(ext_dir, 4)

            from extractor.summer_school.agent_png_extraction import finalize
            with pytest.raises(SystemExit) as exc_info:
                finalize(extracted_dir=ext_dir, image_dir=img_dir)
            msg = str(exc_info.value)
            assert "Missing" in msg
            assert "[1]" in msg
            assert "Orphaned" in msg
            assert "[4]" in msg

    def test_finalize_raises_before_combining(self):
        """finalize() raises before calling combine when coverage is wrong."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            # Create a complete mismatch: PNG for page 1, JSON for page 99
            _make_png(img_dir, 1)
            _make_page_json(ext_dir, 99)

            from extractor.summer_school.agent_png_extraction import finalize
            with pytest.raises(SystemExit) as exc_info:
                finalize(extracted_dir=ext_dir, image_dir=img_dir)
            msg = str(exc_info.value)
            # Both errors should be present
            assert "Missing" in msg
            assert "Orphaned" in msg


class TestPipelineRefusesStaleData:
    """Tests that pipeline.run_stages() refuses to finalize with stale data."""

    def test_pipeline_raises_on_missing_pages(self):
        """pipeline.run_stages() raises SystemExit when pages are missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            for page in [1, 2]:
                _make_png(img_dir, page)
            # Only page 1 has JSON
            _make_page_json(ext_dir, 1)

            # Patch config to use our test directories
            import extractor.summer_school.config as cfg
            import extractor.summer_school.agent_png_extraction as ape
            import extractor.summer_school.pipeline as pipe

            orig_images = cfg.IMAGES_DIR
            orig_extracted = cfg.EXTRACTED_DIR
            try:
                cfg.IMAGES_DIR = img_dir
                cfg.EXTRACTED_DIR = ext_dir
                # Also patch the module-level references
                ape.IMAGES_DIR = img_dir
                ape.EXTRACTED_DIR = ext_dir

                with pytest.raises(SystemExit, match="missing=.*\\[2\\]"):
                    pipe.run_stages(
                        render=False,
                        do_extract=True,
                        do_combine=True,
                    )
            finally:
                cfg.IMAGES_DIR = orig_images
                cfg.EXTRACTED_DIR = orig_extracted
                ape.IMAGES_DIR = orig_images
                ape.EXTRACTED_DIR = orig_extracted

    def test_pipeline_raises_on_orphaned_pages(self):
        """pipeline.run_stages() raises SystemExit when orphaned JSONs exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_dir = Path(tmpdir) / "images"
            ext_dir = Path(tmpdir) / "extracted"
            img_dir.mkdir()
            ext_dir.mkdir()

            _make_png(img_dir, 1)
            _make_page_json(ext_dir, 1)
            _make_page_json(ext_dir, 5)  # orphaned

            import extractor.summer_school.config as cfg
            import extractor.summer_school.agent_png_extraction as ape
            import extractor.summer_school.pipeline as pipe

            orig_images = cfg.IMAGES_DIR
            orig_extracted = cfg.EXTRACTED_DIR
            try:
                cfg.IMAGES_DIR = img_dir
                cfg.EXTRACTED_DIR = ext_dir
                ape.IMAGES_DIR = img_dir
                ape.EXTRACTED_DIR = ext_dir

                with pytest.raises(SystemExit, match="orphaned=.*\\[5\\]"):
                    pipe.run_stages(
                        render=False,
                        do_extract=True,
                        do_combine=True,
                    )
            finally:
                cfg.IMAGES_DIR = orig_images
                cfg.EXTRACTED_DIR = orig_extracted
                ape.IMAGES_DIR = orig_images
                ape.EXTRACTED_DIR = orig_extracted

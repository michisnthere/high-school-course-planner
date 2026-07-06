"""Minimal vision client stub.

This client accepts a page image path and a prompt, and returns valid JSON data.
A stub implementation is used here so the pipeline structure is complete and testable.
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional


class VisionClient:
    def __init__(self, mode: str = "stub") -> None:
        self.mode = mode

    def extract_page(self, image_path: str, prompt: Optional[str] = None) -> Dict[str, Any]:
        if self.mode == "stub":
            return {
                "departments": [],
                "courses": [],
                "graduationRequirements": [],
                "warnings": [
                    f"stub extraction for {os.path.basename(image_path)}"
                ],
            }
        raise NotImplementedError("Only stub mode is implemented in this scaffold.")


def get_client() -> VisionClient:
    mode = os.environ.get("EXTRACTOR_VISION_MODE", "stub")
    return VisionClient(mode=mode)

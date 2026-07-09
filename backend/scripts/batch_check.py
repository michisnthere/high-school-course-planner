#!/usr/bin/env python3
"""Batch classify all pages and generate extraction summary."""
import subprocess
import json
import sys
from pathlib import Path

def classify_pages(start, end):
    """Classify pages in range and return summary."""
    page_list = ' '.join(str(i) for i in range(start, end + 1))
    try:
        result = subprocess.run(
            f'python scripts/check_pages.py --pages {page_list}',
            shell=True,
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.stdout
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return ""

if __name__ == '__main__':
    # Classify pages 1-100 in batches
    print("Classifying pages 1-100...")
    for batch_start in range(1, 101, 20):
        batch_end = min(batch_start + 19, 100)
        print(f"\nBatch {batch_start}-{batch_end}:")
        output = classify_pages(batch_start, batch_end)
        # Print only Page summary lines
        for line in output.split('\n'):
            if line.startswith('Page '):
                print(line)

#!/usr/bin/env python3
"""
Batch full-book extraction pipeline for Phase 1.
Classifies all pages and generates extraction statistics.
"""
import os
import subprocess
import json
from pathlib import Path

def get_pdf_page_count():
    """Determine the number of pages in the PDF."""
    import PyPDF2
    pdf_path = 'resources/stevenson-coursebook.pdf'
    if not os.path.exists(pdf_path):
        print(f"PDF not found at {pdf_path}. Checking alternative paths...")
        # Try to find the PDF in common locations
        possible_paths = [
            'resources/coursebook.pdf',
            'coursebook.pdf',
            'data/coursebook.pdf'
        ]
        for path in possible_paths:
            if os.path.exists(path):
                pdf_path = path
                break
        else:
            print("PDF not found. Using default range 1-100.")
            return 100
    
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            return len(reader.pages)
    except Exception as e:
        print(f"Could not read PDF: {e}. Using default range 1-100.")
        return 100

def classify_all_pages(page_count):
    """Run classification on all pages and collect results."""
    classifications = {}
    
    print(f"Classifying {page_count} pages...")
    for page_num in range(1, page_count + 1):
        try:
            result = subprocess.run(
                ['python', 'scripts/check_pages.py', '--pages', str(page_num)],
                capture_output=True,
                text=True,
                timeout=30
            )
            # Extract classification from output
            for line in result.stdout.split('\n'):
                if f'Page {page_num}:' in line:
                    # Parse classification
                    if 'detailed_course_content' in line:
                        classifications[page_num] = 'detailed_course_content'
                    elif 'academic_policy_content' in line:
                        classifications[page_num] = 'academic_policy_content'
                    elif 'course_listing_summary' in line:
                        classifications[page_num] = 'course_listing_summary'
                    elif 'front_matter_or_sparse_page' in line:
                        classifications[page_num] = 'front_matter_or_sparse_page'
                    else:
                        classifications[page_num] = 'unknown_or_non_course_content'
                    break
            
            if page_num % 10 == 0:
                print(f"  Processed {page_num}/{page_count} pages...")
        except Exception as e:
            print(f"Error classifying page {page_num}: {e}")
            classifications[page_num] = 'error'
    
    return classifications

if __name__ == '__main__':
    page_count = get_pdf_page_count()
    print(f"PDF has {page_count} pages")
    
    # Try quick classification on sample pages first
    result = subprocess.run(
        ['python', 'scripts/check_pages.py', '--pages', '1', '50', '100'],
        capture_output=True,
        text=True,
        timeout=60
    )
    print(result.stdout)

from pathlib import Path

from pypdf import PdfReader


def load_pdf_reader(pdf_path: Path) -> PdfReader:
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    return PdfReader(str(pdf_path))


def extract_page_text(pdf_path: Path, page_number: int) -> str:
    if page_number < 1:
        raise ValueError("Page number must be 1 or greater.")

    reader = load_pdf_reader(pdf_path)
    if page_number > len(reader.pages):
        raise ValueError(f"PDF has only {len(reader.pages)} pages; page {page_number} is out of range.")

    page = reader.pages[page_number - 1]
    return page.extract_text() or ""

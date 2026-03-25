"""
services.resume_parser
~~~~~~~~~~~~~~~~~~~~~~
Extraction of plain text from PDF and DOCX files.
"""

from __future__ import annotations

import io
from fastapi import HTTPException
import pdfplumber
from docx import Document


async def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """
    Dispatcher to extract text based on file extension.
    """
    extension = filename.split(".")[-1].lower()

    if extension == "pdf":
        return await _extract_from_pdf(file_bytes)
    elif extension == "docx":
        return await _extract_from_docx(file_bytes)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{extension}. Please upload a PDF or DOCX file."
        )


async def _extract_from_pdf(file_bytes: bytes) -> str:
    """Extract text from all pages of a PDF using pdfplumber."""
    text_content = []
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_content.append(page_text)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse PDF: {str(e)}"
        )

    return "\n\n".join(text_content).strip()


async def _extract_from_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file using python-docx."""
    try:
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs).strip()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse DOCX: {str(e)}"
        )

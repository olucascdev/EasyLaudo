import re
from io import BytesIO
from pathlib import Path

from docx import Document
from docx.document import Document as DocumentType
from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph

FIELD_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_\- ]+?)\s*\}\}")


def _iter_paragraphs_from_parent(parent):
    if isinstance(parent, DocumentType):
        for paragraph in parent.paragraphs:
            yield paragraph
        for table in parent.tables:
            yield from _iter_paragraphs_from_parent(table)
        return

    if isinstance(parent, Table):
        for row in parent.rows:
            for cell in row.cells:
                yield from _iter_paragraphs_from_parent(cell)
        return

    if isinstance(parent, _Cell):
        for paragraph in parent.paragraphs:
            yield paragraph
        for table in parent.tables:
            yield from _iter_paragraphs_from_parent(table)


def _paragraphs_text(document: DocumentType) -> list[str]:
    return [paragraph.text for paragraph in _iter_paragraphs_from_parent(document) if paragraph.text.strip()]


def extract_template_text(doc_path: str | Path) -> str:
    document = Document(str(doc_path))
    return "\n".join(_paragraphs_text(document))


def extract_fields(doc_path: str | Path) -> list[str]:
    text = extract_template_text(doc_path)
    fields: list[str] = []

    for match in FIELD_PATTERN.findall(text):
        field = match.strip()
        if field not in fields:
            fields.append(field)

    return fields


def _replace_in_paragraph(paragraph: Paragraph, data: dict[str, object]) -> None:
    text = paragraph.text
    replaced = text
    for key, value in data.items():
        replaced = replaced.replace(f"{{{{{key}}}}}", "" if value is None else str(value))

    if replaced != text:
        paragraph.text = replaced


def render_docx(template_path: str | Path, data: dict[str, object]) -> bytes:
    document = Document(str(template_path))

    for paragraph in _iter_paragraphs_from_parent(document):
        _replace_in_paragraph(paragraph, data)

    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def has_markers(doc_path: str | Path) -> bool:
    return bool(extract_fields(doc_path))


def extract_marked_values(doc_path: str | Path, expected_fields: list[str] | None = None) -> dict[str, str | None]:
    text = extract_template_text(doc_path)
    data: dict[str, str | None] = {field: None for field in expected_fields or []}

    for line in text.splitlines():
        matches = list(FIELD_PATTERN.finditer(line))
        if not matches:
            continue

        for match in matches:
            field = match.group(1).strip()
            suffix = line[match.end():].strip(" :-\t")
            prefix = line[: match.start()].strip()

            value = suffix or None
            if not value and ":" in prefix:
                value = prefix.split(":", 1)[-1].strip() or None

            data[field] = value

    return data

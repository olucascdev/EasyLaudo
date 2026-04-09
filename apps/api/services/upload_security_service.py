import os
from io import BytesIO
from zipfile import BadZipFile, ZipFile

from fastapi import HTTPException

DOCX_ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/octet-stream",
}
XLSX_ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/octet-stream",
}


def _positive_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value == "":
        return default

    try:
        parsed = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} deve ser um inteiro positivo.") from exc

    if parsed <= 0:
        raise RuntimeError(f"{name} deve ser maior que zero.")

    return parsed


def _check_zip_safety(content: bytes) -> list[str]:
    max_files = _positive_int_env("MAX_ZIP_FILES", 1000)
    max_total_uncompressed_bytes = _positive_int_env(
        "MAX_ZIP_UNCOMPRESSED_BYTES", 100 * 1024 * 1024
    )
    max_compression_ratio = _positive_int_env("MAX_ZIP_COMPRESSION_RATIO", 100)

    try:
        with ZipFile(BytesIO(content)) as archive:
            file_infos = archive.infolist()
            if len(file_infos) > max_files:
                raise HTTPException(
                    status_code=400, detail="Arquivo compactado possui entradas demais."
                )

            total_uncompressed = 0
            names: list[str] = []
            for file_info in file_infos:
                total_uncompressed += file_info.file_size
                if total_uncompressed > max_total_uncompressed_bytes:
                    raise HTTPException(
                        status_code=400,
                        detail="Arquivo compactado excede o tamanho permitido.",
                    )

                compressed_size = file_info.compress_size or 1
                ratio = file_info.file_size / compressed_size
                if ratio > max_compression_ratio:
                    raise HTTPException(
                        status_code=400,
                        detail="Arquivo compactado com proporcao suspeita.",
                    )

                names.append(file_info.filename)

            return names
    except BadZipFile as exc:
        raise HTTPException(
            status_code=400, detail="Arquivo invalido ou corrompido."
        ) from exc


def _validate_common(filename: str | None, content: bytes) -> None:
    if not filename:
        raise HTTPException(status_code=400, detail="Nome do arquivo nao informado.")

    max_upload_bytes = _positive_int_env("MAX_UPLOAD_BYTES", 15 * 1024 * 1024)
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    if len(content) > max_upload_bytes:
        raise HTTPException(
            status_code=400, detail="Arquivo excede o tamanho maximo permitido."
        )


def validate_docx_upload(
    filename: str | None, content_type: str | None, content: bytes
) -> None:
    _validate_common(filename, content)

    if not filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Envie um arquivo DOCX valido.")

    if content_type and content_type not in DOCX_ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400, detail="Tipo de arquivo DOCX nao suportado."
        )

    zip_entries = _check_zip_safety(content)
    if (
        "[Content_Types].xml" not in zip_entries
        or "word/document.xml" not in zip_entries
    ):
        raise HTTPException(status_code=400, detail="Estrutura DOCX invalida.")


def validate_xlsx_upload(
    filename: str | None, content_type: str | None, content: bytes
) -> None:
    _validate_common(filename, content)

    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Envie um arquivo XLSX valido.")

    if content_type and content_type not in XLSX_ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400, detail="Tipo de arquivo XLSX nao suportado."
        )

    zip_entries = _check_zip_safety(content)
    if "[Content_Types].xml" not in zip_entries or "xl/workbook.xml" not in zip_entries:
        raise HTTPException(status_code=400, detail="Estrutura XLSX invalida.")


def max_extraction_files() -> int:
    return _positive_int_env("MAX_EXTRACTION_FILES", 25)


def validate_security_config() -> None:
    _positive_int_env("MAX_UPLOAD_BYTES", 15 * 1024 * 1024)
    _positive_int_env("MAX_ZIP_FILES", 1000)
    _positive_int_env("MAX_ZIP_UNCOMPRESSED_BYTES", 100 * 1024 * 1024)
    _positive_int_env("MAX_ZIP_COMPRESSION_RATIO", 100)
    _positive_int_env("MAX_EXTRACTION_FILES", 25)

import re
import zipfile
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from psycopg2.extras import Json

from models.schemas import BatchGenerateReportPayload, GenerateReportPayload
from services.auth_service import get_current_user
from services.db_service import execute, fetch_one
from services.docx_service import combine_docx_documents, render_docx
from services.storage_service import read_file_bytes, resolve_storage_path, save_bytes

router = APIRouter(prefix="/laudo", tags=["laudo"])


def _safe_report_name(base_name: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_-]+", "_", base_name.strip()).strip("_")
    return normalized or "laudo"


def _build_report_filename(patient_data: dict) -> str:
    patient_name = patient_data.get("nome") or patient_data.get("paciente") or "paciente"
    date_label = datetime.now().strftime("%Y-%m-%d")
    return f"{_safe_report_name(str(patient_name))}_{date_label}.docx"


def _build_batch_filename(base_name: str, extension: str) -> str:
    date_label = datetime.now().strftime("%Y-%m-%d")
    return f"{_safe_report_name(base_name)}_{date_label}.{extension}"


def _get_template(template_id: str, user_id: str):
    template = fetch_one(
        """
        SELECT id, name, file_path
        FROM templates
        WHERE id = %s AND user_id = %s
        """,
        (template_id, user_id),
    )
    if not template:
        raise HTTPException(status_code=404, detail="Modelo nao encontrado.")
    return template


@router.post("/gerar")
def gerar_laudo(payload: GenerateReportPayload, current_user=Depends(get_current_user)):
    template = _get_template(payload.template_id, str(current_user["id"]))

    try:
        document_bytes = render_docx(resolve_storage_path(template["file_path"]), payload.patient_data)
        filename = payload.filename or _build_report_filename(payload.patient_data)
        relative_path = save_bytes(str(current_user["id"]), "reports", filename, document_bytes)
        report = execute(
            """
            INSERT INTO reports (user_id, template_id, patient_data, file_path, status)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                str(current_user["id"]),
                payload.template_id,
                Json(payload.patient_data),
                relative_path,
                "gerado",
            ),
        )
    except Exception as exc:
        execute(
            """
            INSERT INTO reports (user_id, template_id, patient_data, status)
            VALUES (%s, %s, %s, %s)
            """,
            (str(current_user["id"]), payload.template_id, Json(payload.patient_data), "erro"),
        )
        raise HTTPException(status_code=500, detail=f"Falha ao gerar laudo: {exc}") from exc

    return Response(
        content=document_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Report-Id": str(report["id"]),
        },
    )


@router.post("/lote")
def gerar_lote(payload: BatchGenerateReportPayload, current_user=Depends(get_current_user)):
    template = _get_template(payload.template_id, str(current_user["id"]))
    template_path = resolve_storage_path(template["file_path"])
    rendered_documents: list[tuple[str, bytes]] = []

    for patient_data in payload.patients:
        try:
            filename = _build_report_filename(patient_data)
            document_bytes = render_docx(template_path, patient_data)
            rendered_documents.append((filename, document_bytes))
            relative_path = save_bytes(str(current_user["id"]), "reports", filename, document_bytes)
            execute(
                """
                INSERT INTO reports (user_id, template_id, patient_data, file_path, status)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    str(current_user["id"]),
                    payload.template_id,
                    Json(patient_data),
                    relative_path,
                    "gerado",
                ),
            )
        except Exception:
            execute(
                """
                INSERT INTO reports (user_id, template_id, patient_data, status)
                VALUES (%s, %s, %s, %s)
                """,
                (str(current_user["id"]), payload.template_id, Json(patient_data), "erro"),
            )

    if not rendered_documents:
        raise HTTPException(status_code=400, detail="Nenhum laudo foi gerado para exportacao.")

    if payload.mode == "combined":
        combined_bytes = combine_docx_documents([document_bytes for _, document_bytes in rendered_documents])
        return Response(
            content=combined_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{_build_batch_filename("laudos_combinados", "docx")}"'
            },
        )

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for filename, document_bytes in rendered_documents:
            zip_file.writestr(filename, document_bytes)

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{_build_batch_filename("laudos", "zip")}"'},
    )


@router.get("/{report_id}/download")
def download_laudo(report_id: str, current_user=Depends(get_current_user)):
    report = fetch_one(
        """
        SELECT id, file_path
        FROM reports
        WHERE id = %s AND user_id = %s
        """,
        (report_id, str(current_user["id"])),
    )
    if not report or not report["file_path"]:
        raise HTTPException(status_code=404, detail="Laudo nao encontrado.")

    filename = report["file_path"].split("/")[-1]
    return Response(
        content=read_file_bytes(report["file_path"]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

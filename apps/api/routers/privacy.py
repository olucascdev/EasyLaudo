import os
import shutil
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from models.schemas import success_response
from services.audit_service import log_audit_event
from services.auth_service import clear_auth_cookie, get_current_user
from services.db_service import execute, fetch_all, fetch_one
from services.retention_service import retention_policy
from services.storage_service import ensure_storage

router = APIRouter(prefix="/lgpd", tags=["lgpd"])


def _is_truthy(value: str | None) -> bool:
    if not value:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _serialize(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    return value


def _serialize_rows(rows):
    return [_serialize(dict(row)) for row in rows]


def _mask_email(email: str) -> str:
    if "@" not in email:
        return "***"
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        return f"{name[0]}***@{domain}" if name else f"***@{domain}"
    return f"{name[:2]}***@{domain}"


@router.get("/me/export")
def exportar_meus_dados(request: Request, current_user=Depends(get_current_user)):
    user_id = str(current_user["id"])

    templates = fetch_all(
        """
        SELECT id, name, file_path, fields, created_at
        FROM templates
        WHERE user_id = %s
        ORDER BY created_at DESC
        """,
        (user_id,),
    )
    spreadsheets = fetch_all(
        """
        SELECT id, file_path, columns, row_count, created_at
        FROM spreadsheets
        WHERE user_id = %s
        ORDER BY created_at DESC
        """,
        (user_id,),
    )
    reports = fetch_all(
        """
        SELECT id, template_id, patient_data, file_path, status, created_at
        FROM reports
        WHERE user_id = %s
        ORDER BY created_at DESC
        """,
        (user_id,),
    )
    editor_drafts = fetch_all(
        """
        SELECT id, mapping_id, patients, selected_index, created_at, updated_at
        FROM editor_drafts
        WHERE user_id = %s
        ORDER BY updated_at DESC
        """,
        (user_id,),
    )
    mappings = fetch_all(
        """
        SELECT DISTINCT m.id, m.spreadsheet_id, m.template_id, m.map, m.created_at
        FROM mappings m
        LEFT JOIN spreadsheets s ON s.id = m.spreadsheet_id
        LEFT JOIN templates t ON t.id = m.template_id
        WHERE s.user_id = %s OR t.user_id = %s
        ORDER BY m.created_at DESC
        """,
        (user_id, user_id),
    )

    payload = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "request_id": getattr(request.state, "request_id", None),
        "retention_policy": retention_policy(),
        "user": {
            "id": user_id,
            "email": current_user["email"],
            "created_at": _serialize(current_user["created_at"]),
        },
        "data": {
            "templates": _serialize_rows(templates),
            "spreadsheets": _serialize_rows(spreadsheets),
            "mappings": _serialize_rows(mappings),
            "reports": _serialize_rows(reports),
            "editor_drafts": _serialize_rows(editor_drafts),
        },
    }

    log_audit_event(
        action="lgpd.export_me",
        actor_id=user_id,
        request_id=getattr(request.state, "request_id", None),
        status="ok",
        metadata={
            "email_masked": _mask_email(current_user["email"]),
            "counts": {
                "templates": len(templates),
                "spreadsheets": len(spreadsheets),
                "mappings": len(mappings),
                "reports": len(reports),
                "editor_drafts": len(editor_drafts),
            },
        },
    )

    return success_response(payload)


@router.delete("/me")
def excluir_minha_conta(request: Request, current_user=Depends(get_current_user)):
    user_id = str(current_user["id"])

    user_exists = fetch_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not user_exists:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

    template_paths = fetch_all(
        "SELECT file_path FROM templates WHERE user_id = %s",
        (user_id,),
    )
    spreadsheet_paths = fetch_all(
        "SELECT file_path FROM spreadsheets WHERE user_id = %s",
        (user_id,),
    )
    report_paths = fetch_all(
        "SELECT file_path FROM reports WHERE user_id = %s AND file_path IS NOT NULL",
        (user_id,),
    )

    file_paths = {
        row["file_path"]
        for row in [*template_paths, *spreadsheet_paths, *report_paths]
        if row.get("file_path")
    }

    execute("DELETE FROM users WHERE id = %s", (user_id,))

    base_path = ensure_storage().resolve()
    for relative_path in file_paths:
        candidate = (base_path / relative_path).resolve()
        try:
            candidate.relative_to(base_path)
        except ValueError:
            continue
        if candidate.exists() and candidate.is_file():
            candidate.unlink()

    user_dir = (base_path / user_id).resolve()
    try:
        user_dir.relative_to(base_path)
    except ValueError:
        user_dir = None

    if user_dir and user_dir.exists() and user_dir.is_dir():
        shutil.rmtree(user_dir, ignore_errors=True)

    response = success_response(
        {
            "deleted": True,
            "deleted_file_candidates": len(file_paths),
            "message": "Conta e dados vinculados removidos.",
        }
    )
    clear_auth_cookie(response)

    log_audit_event(
        action="lgpd.delete_me",
        actor_id=user_id,
        request_id=getattr(request.state, "request_id", None),
        status="ok",
        metadata={
            "email_masked": _mask_email(current_user["email"]),
            "deleted_file_candidates": len(file_paths),
        },
    )

    return response


@router.get("/retention/policy")
def ver_politica_retencao(current_user=Depends(get_current_user)):
    _ = current_user
    return success_response(retention_policy())


@router.get("/transparencia")
def transparencia_lgpd(current_user=Depends(get_current_user)):
    _ = current_user
    return success_response(
        {
            "processing_purposes": [
                "autenticacao e controle de acesso",
                "importacao de planilhas para geracao de laudos",
                "geracao e download de laudos",
                "extracao de dados de arquivos DOCX",
            ],
            "third_party_processing": {
                "ai_extraction_enabled": _is_truthy(
                    os.getenv("ALLOW_AI_EXTRACTION", "true")
                ),
                "provider": "Anthropic",
            },
            "retention_policy": retention_policy(),
        }
    )

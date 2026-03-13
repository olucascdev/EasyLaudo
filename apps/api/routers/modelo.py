from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from psycopg2.extras import Json

from models.schemas import SaveTemplatePayload, UpdateTemplateFieldsPayload, success_response
from services.auth_service import get_current_user
from services.db_service import execute, fetch_all, fetch_one
from services.docx_service import inspect_template
from services.storage_service import delete_file, read_file_bytes, resolve_storage_path, save_bytes, save_upload

router = APIRouter(prefix="/modelo", tags=["modelo"])


def _normalize_fields(fields: list[str]) -> list[str]:
    normalized: list[str] = []

    for raw_field in fields:
        field = raw_field.strip()
        if field.startswith("{{") and field.endswith("}}"):
            field = field[2:-2].strip()

        if field and field not in normalized:
            normalized.append(field)

    return normalized


def _serialize_template(template, *, text: str | None = None, detected_fields: list[str] | None = None) -> dict[str, object]:
    data: dict[str, object] = {
        "id": str(template["id"]),
        "name": template["name"],
        "file_path": template["file_path"],
        "fields": template["fields"],
        "created_at": template["created_at"].isoformat(),
    }
    if text is not None:
        data["text"] = text
    if detected_fields is not None:
        data["detected_fields"] = detected_fields

    return data


def _validate_owned_file(file_path: str, user_id: str):
    normalized_path = Path(file_path).as_posix().lstrip("/")
    if not normalized_path.startswith(f"{user_id}/"):
        raise HTTPException(status_code=400, detail="Arquivo de modelo invalido.")

    absolute_path = resolve_storage_path(normalized_path)
    if not absolute_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo de modelo nao encontrado.")

    return normalized_path, absolute_path


def _validate_draft_file(file_path: str, user_id: str):
    normalized_path, absolute_path = _validate_owned_file(file_path, user_id)
    if "/template_drafts/" not in normalized_path:
        raise HTTPException(status_code=400, detail="Rascunho de modelo invalido.")

    return normalized_path, absolute_path


@router.post("/processar-upload")
async def processar_upload_modelo(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    user_id = str(current_user["id"])

    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Envie um arquivo DOCX valido.")

    content = await file.read()
    relative_path = save_upload(user_id, "template_drafts", file.filename, content)

    try:
        analysis = inspect_template(resolve_storage_path(relative_path))
    except Exception:
        delete_file(relative_path)
        raise

    return success_response(
        {
            "file_path": relative_path,
            "filename": file.filename,
            "text": analysis["text"],
            "detected_fields": analysis["detected_fields"],
        },
        status_code=201,
    )


@router.post("")
def salvar_modelo(payload: SaveTemplatePayload, current_user=Depends(get_current_user)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Informe um nome para o modelo.")

    fields = _normalize_fields(payload.fields)
    if not fields:
        raise HTTPException(status_code=400, detail="Confirme ao menos um campo antes de salvar.")

    user_id = str(current_user["id"])
    draft_relative_path, _ = _validate_draft_file(payload.file_path, user_id)
    template_relative_path = save_bytes(
        user_id,
        "templates",
        Path(draft_relative_path).name,
        read_file_bytes(draft_relative_path),
    )

    try:
        template = execute(
            """
            INSERT INTO templates (user_id, name, file_path, fields)
            VALUES (%s, %s, %s, %s)
            RETURNING id, name, file_path, fields, created_at
            """,
            (user_id, name, template_relative_path, Json(fields)),
        )
    except Exception:
        delete_file(template_relative_path)
        raise
    finally:
        delete_file(draft_relative_path)

    analysis = inspect_template(resolve_storage_path(template_relative_path))
    return success_response(
        _serialize_template(
            template,
            text=str(analysis["text"]),
            detected_fields=list(analysis["detected_fields"]),
        ),
        status_code=201,
    )


@router.get("/list")
def listar_modelos(current_user=Depends(get_current_user)):
    templates = fetch_all(
        """
        SELECT id, name, file_path, fields, created_at
        FROM templates
        WHERE user_id = %s
        ORDER BY created_at DESC
        """,
        (str(current_user["id"]),),
    )

    data = [
        _serialize_template(template)
        for template in templates
    ]
    return success_response(data)


@router.get("/{template_id}")
def detalhar_modelo(template_id: str, current_user=Depends(get_current_user)):
    template = fetch_one(
        """
        SELECT id, name, file_path, fields, created_at
        FROM templates
        WHERE id = %s AND user_id = %s
        """,
        (template_id, str(current_user["id"])),
    )
    if not template:
        raise HTTPException(status_code=404, detail="Modelo nao encontrado.")

    absolute_path = resolve_storage_path(template["file_path"])
    analysis = inspect_template(absolute_path)
    return success_response(
        _serialize_template(
            template,
            text=str(analysis["text"]),
            detected_fields=list(analysis["detected_fields"]),
        )
    )


@router.get("/{template_id}/campos")
def campos_modelo(template_id: str, current_user=Depends(get_current_user)):
    template = fetch_one(
        """
        SELECT id, fields
        FROM templates
        WHERE id = %s AND user_id = %s
        """,
        (template_id, str(current_user["id"])),
    )
    if not template:
        raise HTTPException(status_code=404, detail="Modelo nao encontrado.")

    return success_response({"id": str(template["id"]), "fields": template["fields"]})


@router.delete("/rascunho")
def deletar_rascunho_modelo(file_path: str, current_user=Depends(get_current_user)):
    draft_relative_path, _ = _validate_draft_file(file_path, str(current_user["id"]))
    delete_file(draft_relative_path)
    return success_response({"file_path": draft_relative_path, "deleted": True})


@router.put("/{template_id}/campos")
def atualizar_campos_modelo(
    template_id: str,
    payload: UpdateTemplateFieldsPayload,
    current_user=Depends(get_current_user),
):
    fields = _normalize_fields(payload.fields)
    if not fields:
        raise HTTPException(status_code=400, detail="Confirme ao menos um campo antes de salvar.")

    template = execute(
        """
        UPDATE templates
        SET fields = %s
        WHERE id = %s AND user_id = %s
        RETURNING id, name, file_path, fields, created_at
        """,
        (Json(fields), template_id, str(current_user["id"])),
    )
    if not template:
        raise HTTPException(status_code=404, detail="Modelo nao encontrado.")

    analysis = inspect_template(resolve_storage_path(template["file_path"]))
    return success_response(
        _serialize_template(
            template,
            text=str(analysis["text"]),
            detected_fields=list(analysis["detected_fields"]),
        )
    )


@router.delete("/{template_id}")
def deletar_modelo(template_id: str, current_user=Depends(get_current_user)):
    template = execute(
        """
        DELETE FROM templates
        WHERE id = %s AND user_id = %s
        RETURNING id, file_path
        """,
        (template_id, str(current_user["id"])),
    )
    if not template:
        raise HTTPException(status_code=404, detail="Modelo nao encontrado.")

    delete_file(template["file_path"])
    return success_response({"id": str(template["id"]), "deleted": True})

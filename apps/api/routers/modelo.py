from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from psycopg2.extras import Json

from models.schemas import success_response
from services.auth_service import get_current_user
from services.db_service import execute, fetch_all, fetch_one
from services.docx_service import extract_fields, extract_template_text
from services.storage_service import delete_file, resolve_storage_path, save_upload

router = APIRouter(prefix="/modelo", tags=["modelo"])


@router.post("/upload")
async def upload_modelo(
    name: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    if not name.strip():
        raise HTTPException(status_code=400, detail="Informe um nome para o modelo.")

    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Envie um arquivo DOCX valido.")

    content = await file.read()
    relative_path = save_upload(str(current_user["id"]), "templates", file.filename, content)
    absolute_path = resolve_storage_path(relative_path)
    fields = extract_fields(absolute_path)
    text = extract_template_text(absolute_path)

    template = execute(
        """
        INSERT INTO templates (user_id, name, file_path, fields)
        VALUES (%s, %s, %s, %s)
        RETURNING id, name, file_path, fields, created_at
        """,
        (str(current_user["id"]), name.strip(), relative_path, Json(fields)),
    )

    return success_response(
        {
            "id": str(template["id"]),
            "name": template["name"],
            "fields": template["fields"],
            "file_path": template["file_path"],
            "text": text,
            "created_at": template["created_at"].isoformat(),
        },
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
        {
            "id": str(template["id"]),
            "name": template["name"],
            "file_path": template["file_path"],
            "fields": template["fields"],
            "created_at": template["created_at"].isoformat(),
        }
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
    return success_response(
        {
            "id": str(template["id"]),
            "name": template["name"],
            "file_path": template["file_path"],
            "fields": template["fields"],
            "text": extract_template_text(absolute_path),
            "created_at": template["created_at"].isoformat(),
        }
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

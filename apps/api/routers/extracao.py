import json
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from models.schemas import ExportRowsPayload, success_response
from services.auth_service import get_current_user
from services.docx_service import (
    extract_marked_values,
    extract_template_text,
    has_markers,
)
from services.excel_service import export_rows_to_xlsx
from services.ia_service import extrair_com_ia
from services.storage_service import resolve_storage_path, save_upload
from services.upload_security_service import max_extraction_files, validate_docx_upload

router = APIRouter(prefix="/extracao", tags=["extracao"])


def _parse_fields(raw_fields: str) -> list[str]:
    if not raw_fields.strip():
        return []

    try:
        parsed = json.loads(raw_fields)
        if isinstance(parsed, list):
            return [str(field).strip() for field in parsed if str(field).strip()]
    except json.JSONDecodeError:
        pass

    return [field.strip() for field in raw_fields.split(",") if field.strip()]


@router.post("/processar")
async def processar_docx(
    files: list[UploadFile] = File(...),
    fields: str = Form(""),
    current_user=Depends(get_current_user),
):
    parsed_fields = _parse_fields(fields)
    if not files:
        raise HTTPException(status_code=400, detail="Envie pelo menos um arquivo DOCX.")
    if len(files) > max_extraction_files():
        raise HTTPException(
            status_code=400, detail="Quantidade de arquivos excede o limite permitido."
        )

    results = []
    for file in files:
        if not file.filename or not file.filename.lower().endswith(".docx"):
            results.append(
                {
                    "filename": file.filename or "arquivo",
                    "status": "erro",
                    "method": "validacao",
                    "data": {},
                    "message": "Arquivo invalido.",
                }
            )
            continue

        content = await file.read()
        try:
            validate_docx_upload(file.filename, file.content_type, content)
        except HTTPException as validation_error:
            results.append(
                {
                    "filename": file.filename,
                    "status": "erro",
                    "method": "validacao",
                    "data": {},
                    "message": validation_error.detail,
                }
            )
            continue

        relative_path = save_upload(
            str(current_user["id"]), "extractions", file.filename, content
        )
        absolute_path = resolve_storage_path(relative_path)

        try:
            if has_markers(absolute_path):
                data = extract_marked_values(absolute_path, parsed_fields or None)
                method = "marcadores"
            else:
                text = extract_template_text(absolute_path)
                data = (
                    extrair_com_ia(text, parsed_fields)
                    if parsed_fields
                    else {"texto": text}
                )
                method = "ia" if parsed_fields else "texto"

            results.append(
                {
                    "filename": file.filename,
                    "status": "ok",
                    "method": method,
                    "data": data,
                }
            )
        except Exception:
            results.append(
                {
                    "filename": file.filename,
                    "status": "extração manual necessária",
                    "method": "erro",
                    "data": {field: None for field in parsed_fields},
                    "message": "Falha ao processar o documento com seguranca.",
                }
            )

    return success_response(results)


@router.post("/exportar")
def exportar_xlsx(payload: ExportRowsPayload, current_user=Depends(get_current_user)):
    filename = f"extracao_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    xlsx_bytes = export_rows_to_xlsx(payload.rows)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

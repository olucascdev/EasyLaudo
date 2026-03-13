from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from psycopg2.extras import Json

from models.schemas import success_response
from services.auth_service import get_current_user
from services.db_service import execute, fetch_all, fetch_one
from services.excel_service import read_spreadsheet
from services.storage_service import delete_file, resolve_storage_path, save_upload

router = APIRouter(prefix="/planilha", tags=["planilha"])


@router.post("/upload")
async def upload_planilha(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Envie um arquivo XLSX valido.")

    content = await file.read()
    relative_path = save_upload(str(current_user["id"]), "spreadsheets", file.filename, content)
    spreadsheet_data = read_spreadsheet(resolve_storage_path(relative_path))

    spreadsheet = execute(
        """
        INSERT INTO spreadsheets (user_id, file_path, columns, row_count)
        VALUES (%s, %s, %s, %s)
        RETURNING id, file_path, columns, row_count, created_at
        """,
        (
            str(current_user["id"]),
            relative_path,
            Json(spreadsheet_data["columns"]),
            spreadsheet_data["row_count"],
        ),
    )

    return success_response(
        {
            "id": str(spreadsheet["id"]),
            "file_path": spreadsheet["file_path"],
            "columns": spreadsheet["columns"],
            "row_count": spreadsheet["row_count"],
            "preview": spreadsheet_data["preview"],
            "created_at": spreadsheet["created_at"].isoformat(),
        },
        status_code=201,
    )


@router.get("/list")
def listar_planilhas(current_user=Depends(get_current_user)):
    spreadsheets = fetch_all(
        """
        SELECT id, file_path, columns, row_count, created_at
        FROM spreadsheets
        WHERE user_id = %s
        ORDER BY created_at DESC
        """,
        (str(current_user["id"]),),
    )

    return success_response(
        [
            {
                "id": str(spreadsheet["id"]),
                "file_path": spreadsheet["file_path"],
                "columns": spreadsheet["columns"],
                "row_count": spreadsheet["row_count"],
                "created_at": spreadsheet["created_at"].isoformat(),
            }
            for spreadsheet in spreadsheets
        ]
    )


@router.get("/{spreadsheet_id}")
def detalhar_planilha(spreadsheet_id: str, current_user=Depends(get_current_user)):
    spreadsheet = fetch_one(
        """
        SELECT id, file_path, columns, row_count, created_at
        FROM spreadsheets
        WHERE id = %s AND user_id = %s
        """,
        (spreadsheet_id, str(current_user["id"])),
    )
    if not spreadsheet:
        raise HTTPException(status_code=404, detail="Planilha nao encontrada.")

    file_data = read_spreadsheet(resolve_storage_path(spreadsheet["file_path"]))
    return success_response(
        {
            "id": str(spreadsheet["id"]),
            "file_path": spreadsheet["file_path"],
            "columns": spreadsheet["columns"],
            "row_count": spreadsheet["row_count"],
            "preview": file_data["preview"],
            "rows": file_data["rows"],
            "created_at": spreadsheet["created_at"].isoformat(),
        }
    )


@router.delete("/{spreadsheet_id}")
def excluir_planilha(spreadsheet_id: str, current_user=Depends(get_current_user)):
    spreadsheet = execute(
        """
        DELETE FROM spreadsheets
        WHERE id = %s AND user_id = %s
        RETURNING id, file_path
        """,
        (spreadsheet_id, str(current_user["id"])),
    )
    if not spreadsheet:
        raise HTTPException(status_code=404, detail="Planilha nao encontrada.")

    delete_file(spreadsheet["file_path"])

    return success_response({"id": str(spreadsheet["id"]), "deleted": True})


@router.post("/{spreadsheet_id}/delete")
def excluir_planilha_post(spreadsheet_id: str, current_user=Depends(get_current_user)):
    return excluir_planilha(spreadsheet_id, current_user)

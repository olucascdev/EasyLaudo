from fastapi import APIRouter, Depends

from models.schemas import success_response
from services.auth_service import get_current_user
from services.db_service import fetch_all, fetch_one

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
def overview(current_user=Depends(get_current_user)):
    user_id = str(current_user["id"])

    report_counts = fetch_one(
        """
        SELECT
          COUNT(*) FILTER (WHERE status = 'gerado') AS gerado,
          COUNT(*) FILTER (WHERE status = 'pendente') AS pendente,
          COUNT(*) FILTER (WHERE status = 'erro') AS erro
        FROM reports
        WHERE user_id = %s
        """,
        (user_id,),
    )

    reports = fetch_all(
        """
        SELECT id, template_id, patient_data, file_path, status, created_at
        FROM reports
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 10
        """,
        (user_id,),
    )

    spreadsheets = fetch_all(
        """
        SELECT id, file_path, columns, row_count, created_at
        FROM spreadsheets
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 5
        """,
        (user_id,),
    )

    templates = fetch_all(
        """
        SELECT id, name, fields, created_at
        FROM templates
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 5
        """,
        (user_id,),
    )

    return success_response(
        {
            "report_counts": {
                "gerado": int(report_counts["gerado"] or 0),
                "pendente": int(report_counts["pendente"] or 0),
                "erro": int(report_counts["erro"] or 0),
            },
            "reports": [
                {
                    "id": str(report["id"]),
                    "template_id": str(report["template_id"]) if report["template_id"] else None,
                    "patient_data": report["patient_data"],
                    "file_path": report["file_path"],
                    "status": report["status"],
                    "created_at": report["created_at"].isoformat(),
                }
                for report in reports
            ],
            "spreadsheets": [
                {
                    "id": str(spreadsheet["id"]),
                    "file_path": spreadsheet["file_path"],
                    "columns": spreadsheet["columns"],
                    "row_count": spreadsheet["row_count"],
                    "created_at": spreadsheet["created_at"].isoformat(),
                }
                for spreadsheet in spreadsheets
            ],
            "templates": [
                {
                    "id": str(template["id"]),
                    "name": template["name"],
                    "fields": template["fields"],
                    "created_at": template["created_at"].isoformat(),
                }
                for template in templates
            ],
        }
    )


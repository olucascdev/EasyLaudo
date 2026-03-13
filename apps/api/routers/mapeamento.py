import re
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extras import Json

from models.schemas import SaveMappingPayload, success_response
from services.auth_service import get_current_user
from services.db_service import execute, fetch_one

router = APIRouter(prefix="/mapeamento", tags=["mapeamento"])


def _normalize_label(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def suggest_mapping(columns: list[str], fields: list[str]) -> dict[str, str]:
    suggestions: dict[str, str] = {}

    for column in columns:
        best_match = ""
        best_score = 0.0
        normalized_column = _normalize_label(column)

        for field in fields:
            score = SequenceMatcher(None, normalized_column, _normalize_label(field)).ratio()
            if score > best_score:
                best_match = field
                best_score = score

        if best_match and best_score >= 0.55:
            suggestions[column] = best_match

    return suggestions


@router.post("/salvar")
def salvar_mapeamento(payload: SaveMappingPayload, current_user=Depends(get_current_user)):
    ownership = fetch_one(
        """
        SELECT s.id AS spreadsheet_id, t.id AS template_id
        FROM spreadsheets s
        JOIN templates t ON t.id = %s
        WHERE s.id = %s AND s.user_id = %s AND t.user_id = %s
        """,
        (
            payload.template_id,
            payload.spreadsheet_id,
            str(current_user["id"]),
            str(current_user["id"]),
        ),
    )
    if not ownership:
        raise HTTPException(status_code=404, detail="Planilha ou modelo nao encontrado.")

    existing = fetch_one(
        """
        SELECT id
        FROM mappings
        WHERE spreadsheet_id = %s AND template_id = %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (payload.spreadsheet_id, payload.template_id),
    )

    if existing:
        mapping = execute(
            """
            UPDATE mappings
            SET map = %s, created_at = NOW()
            WHERE id = %s
            RETURNING id, spreadsheet_id, template_id, map, created_at
            """,
            (Json(payload.map), str(existing["id"])),
        )
    else:
        mapping = execute(
            """
            INSERT INTO mappings (spreadsheet_id, template_id, map)
            VALUES (%s, %s, %s)
            RETURNING id, spreadsheet_id, template_id, map, created_at
            """,
            (payload.spreadsheet_id, payload.template_id, Json(payload.map)),
        )

    return success_response(
        {
            "id": str(mapping["id"]),
            "spreadsheet_id": str(mapping["spreadsheet_id"]),
            "template_id": str(mapping["template_id"]),
            "map": mapping["map"],
            "created_at": mapping["created_at"].isoformat(),
        }
    )


@router.get("/buscar")
def buscar_mapeamento(spreadsheet_id: str, template_id: str, current_user=Depends(get_current_user)):
    pair = fetch_one(
        """
        SELECT s.columns, t.fields
        FROM spreadsheets s
        JOIN templates t ON t.id = %s
        WHERE s.id = %s AND s.user_id = %s AND t.user_id = %s
        """,
        (template_id, spreadsheet_id, str(current_user["id"]), str(current_user["id"])),
    )
    if not pair:
        raise HTTPException(status_code=404, detail="Planilha ou modelo nao encontrado.")

    mapping = fetch_one(
        """
        SELECT id, spreadsheet_id, template_id, map, created_at
        FROM mappings
        WHERE spreadsheet_id = %s AND template_id = %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (spreadsheet_id, template_id),
    )

    data = {
        "spreadsheet_id": spreadsheet_id,
        "template_id": template_id,
        "saved_map": mapping["map"] if mapping else {},
        "suggested_map": suggest_mapping(pair["columns"], pair["fields"]),
    }

    if mapping:
        data["id"] = str(mapping["id"])
        data["created_at"] = mapping["created_at"].isoformat()

    return success_response(data)


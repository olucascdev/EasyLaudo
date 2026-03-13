import re
from pathlib import Path
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extras import Json

from models.schemas import SaveEditorDraftPayload, SaveMappingPayload, success_response
from services.auth_service import get_current_user
from services.db_service import execute, fetch_all, fetch_one
from services.docx_service import inspect_template
from services.excel_service import read_spreadsheet
from services.storage_service import resolve_storage_path

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


def _build_patients(
    rows: list[dict[str, str]],
    fields: list[str],
    mapping: dict[str, str],
) -> list[dict[str, str]]:
    patients: list[dict[str, str]] = []

    for row in rows:
        patient = {field: "" for field in fields}

        for column, field in mapping.items():
            if not field or field == "__ignore__":
                continue
            patient[field] = row.get(column, "")

        patients.append(patient)

    return patients


def _serialize_flow_summary(flow) -> dict[str, object]:
    updated_at = flow["draft_updated_at"] or flow["mapping_created_at"]
    return {
        "mapping_id": str(flow["mapping_id"]),
        "spreadsheet_id": str(flow["spreadsheet_id"]),
        "spreadsheet_name": Path(flow["spreadsheet_file_path"]).name,
        "template_id": str(flow["template_id"]),
        "template_name": flow["template_name"],
        "row_count": flow["row_count"],
        "has_draft": bool(flow["draft_id"]),
        "updated_at": updated_at.isoformat(),
    }


def _get_owned_mapping(mapping_id: str, user_id: str):
    mapping = fetch_one(
        """
        SELECT
            m.id AS mapping_id,
            m.spreadsheet_id,
            m.template_id,
            m.map,
            m.created_at AS mapping_created_at,
            s.file_path AS spreadsheet_file_path,
            s.columns AS spreadsheet_columns,
            s.row_count,
            s.created_at AS spreadsheet_created_at,
            t.name AS template_name,
            t.file_path AS template_file_path,
            t.fields AS template_fields,
            t.created_at AS template_created_at,
            d.id AS draft_id,
            d.patients AS draft_patients,
            d.selected_index AS draft_selected_index,
            d.updated_at AS draft_updated_at
        FROM mappings m
        JOIN spreadsheets s ON s.id = m.spreadsheet_id
        JOIN templates t ON t.id = m.template_id
        LEFT JOIN editor_drafts d ON d.mapping_id = m.id AND d.user_id = s.user_id
        WHERE m.id = %s AND s.user_id = %s AND t.user_id = %s
        """,
        (mapping_id, user_id, user_id),
    )
    if not mapping:
        raise HTTPException(status_code=404, detail="Fluxo salvo nao encontrado.")

    return mapping


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


@router.get("/list")
def listar_fluxos_salvos(current_user=Depends(get_current_user)):
    flows = fetch_all(
        """
        SELECT
            m.id AS mapping_id,
            m.spreadsheet_id,
            m.template_id,
            m.created_at AS mapping_created_at,
            s.file_path AS spreadsheet_file_path,
            s.row_count,
            t.name AS template_name,
            d.id AS draft_id,
            d.updated_at AS draft_updated_at
        FROM mappings m
        JOIN spreadsheets s ON s.id = m.spreadsheet_id
        JOIN templates t ON t.id = m.template_id
        LEFT JOIN editor_drafts d ON d.mapping_id = m.id AND d.user_id = s.user_id
        WHERE s.user_id = %s AND t.user_id = %s
        ORDER BY COALESCE(d.updated_at, m.created_at) DESC
        """,
        (str(current_user["id"]), str(current_user["id"])),
    )

    return success_response([_serialize_flow_summary(flow) for flow in flows])


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


@router.get("/{mapping_id}/editor-context")
def buscar_contexto_editor(mapping_id: str, current_user=Depends(get_current_user)):
    mapping = _get_owned_mapping(mapping_id, str(current_user["id"]))
    spreadsheet_data = read_spreadsheet(resolve_storage_path(mapping["spreadsheet_file_path"]))
    template_analysis = inspect_template(resolve_storage_path(mapping["template_file_path"]))

    patients = mapping["draft_patients"]
    selected_index = mapping["draft_selected_index"] or 0

    if not mapping["draft_id"]:
        patients = _build_patients(spreadsheet_data["rows"], mapping["template_fields"], mapping["map"])
        selected_index = 0

    return success_response(
        {
            "mapping_id": str(mapping["mapping_id"]),
            "spreadsheet": {
                "id": str(mapping["spreadsheet_id"]),
                "file_path": mapping["spreadsheet_file_path"],
                "columns": spreadsheet_data["columns"],
                "row_count": spreadsheet_data["row_count"],
                "preview": spreadsheet_data["preview"],
                "rows": spreadsheet_data["rows"],
                "sheet_name": spreadsheet_data["sheet_name"],
                "header_row_index": spreadsheet_data["header_row_index"],
                "created_at": mapping["spreadsheet_created_at"].isoformat(),
            },
            "template": {
                "id": str(mapping["template_id"]),
                "name": mapping["template_name"],
                "file_path": mapping["template_file_path"],
                "fields": mapping["template_fields"],
                "text": str(template_analysis["text"]),
                "detected_fields": list(template_analysis["detected_fields"]),
                "created_at": mapping["template_created_at"].isoformat(),
            },
            "mapping": mapping["map"],
            "patients": patients,
            "selected_index": min(selected_index, max(len(patients) - 1, 0)),
            "has_draft": bool(mapping["draft_id"]),
        }
    )


@router.put("/{mapping_id}/editor-draft")
def salvar_rascunho_editor(
    mapping_id: str,
    payload: SaveEditorDraftPayload,
    current_user=Depends(get_current_user),
):
    mapping = _get_owned_mapping(mapping_id, str(current_user["id"]))

    if mapping["draft_id"]:
        draft = execute(
            """
            UPDATE editor_drafts
            SET patients = %s, selected_index = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id, mapping_id, patients, selected_index, updated_at
            """,
            (Json(payload.patients), payload.selected_index, str(mapping["draft_id"])),
        )
    else:
        draft = execute(
            """
            INSERT INTO editor_drafts (user_id, mapping_id, patients, selected_index)
            VALUES (%s, %s, %s, %s)
            RETURNING id, mapping_id, patients, selected_index, updated_at
            """,
            (str(current_user["id"]), mapping_id, Json(payload.patients), payload.selected_index),
        )

    return success_response(
        {
            "id": str(draft["id"]),
            "mapping_id": str(draft["mapping_id"]),
            "patients": draft["patients"],
            "selected_index": draft["selected_index"],
            "updated_at": draft["updated_at"].isoformat(),
        }
    )


@router.delete("/{mapping_id}")
def deletar_fluxo_salvo(mapping_id: str, current_user=Depends(get_current_user)):
    _get_owned_mapping(mapping_id, str(current_user["id"]))
    deleted = execute(
        """
        DELETE FROM mappings
        WHERE id = %s
        RETURNING id
        """,
        (mapping_id,),
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Fluxo salvo nao encontrado.")

    return success_response({"id": str(deleted["id"]), "deleted": True})

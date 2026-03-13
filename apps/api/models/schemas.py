from typing import Any

from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


class RegisterPayload(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginPayload(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class SaveMappingPayload(BaseModel):
    spreadsheet_id: str
    template_id: str
    map: dict[str, str] = Field(default_factory=dict)


class GenerateReportPayload(BaseModel):
    template_id: str
    patient_data: dict[str, Any] = Field(default_factory=dict)
    filename: str | None = None


class BatchGenerateReportPayload(BaseModel):
    template_id: str
    patients: list[dict[str, Any]] = Field(default_factory=list)


class ExportRowsPayload(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)


def success_response(data: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "data": data},
    )


def error_response(message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": message},
    )

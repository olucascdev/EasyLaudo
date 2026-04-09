import os
import logging
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models.schemas import error_response, success_response
from routers import (
    auth,
    compliance,
    dashboard,
    extracao,
    laudo,
    mapeamento,
    modelo,
    planilha,
    privacy,
)
from services.auth_service import (
    validate_security_config as validate_auth_security_config,
)
from services.login_protection_service import (
    validate_security_config as validate_login_protection_config,
)
from services.ia_service import (
    validate_security_config as validate_ia_security_config,
)
from services.rate_limit_service import (
    check_rate_limit,
    validate_security_config as validate_rate_limit_config,
)
from services.retention_service import (
    validate_security_config as validate_retention_security_config,
)
from services.storage_service import ensure_storage
from services.upload_security_service import (
    validate_security_config as validate_upload_security_config,
)

app = FastAPI(title="EasyLaudo API", version="0.1.0")
logger = logging.getLogger("easylaudo.api")

allow_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3031,http://localhost",
    ).split(",")
    if origin.strip()
]
allow_origin_regex = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-Request-ID",
        "X-Maintenance-Token",
    ],
)


@app.on_event("startup")
def startup_event():
    ensure_storage()
    validate_auth_security_config()
    validate_upload_security_config()
    validate_rate_limit_config()
    validate_login_protection_config()
    validate_retention_security_config()
    validate_ia_security_config()


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    incoming_request_id = request.headers.get("X-Request-ID", "").strip()
    request_id = incoming_request_id[:64] if incoming_request_id else uuid4().hex
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


def _resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path == "/health" or request.method == "OPTIONS":
        return await call_next(request)

    client_ip = _resolve_client_ip(request)
    allowed, retry_after = check_rate_limit(request.url.path, client_ip)
    if not allowed:
        response = JSONResponse(
            status_code=429,
            content={
                "success": False,
                "error": "Muitas requisicoes. Aguarde e tente novamente.",
            },
        )
        response.headers["Retry-After"] = str(retry_after)
        response.headers["X-Request-ID"] = getattr(request.state, "request_id", "")
        return response

    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return error_response(str(exc.detail), status_code=exc.status_code)


@app.exception_handler(Exception)
async def generic_exception_handler(_: Request, _exc: Exception):
    logger.exception("Erro inesperado na API")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Erro interno do servidor."},
    )


@app.get("/health")
def health():
    return success_response({"status": "ok"})


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(modelo.router)
app.include_router(planilha.router)
app.include_router(mapeamento.router)
app.include_router(laudo.router)
app.include_router(extracao.router)
app.include_router(privacy.router)
app.include_router(compliance.router)

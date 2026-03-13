import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models.schemas import error_response, success_response
from routers import auth, dashboard, extracao, laudo, mapeamento, modelo, planilha
from services.storage_service import ensure_storage

app = FastAPI(title="EasyLaudo API", version="0.1.0")

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
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    ensure_storage()


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return error_response(str(exc.detail), status_code=exc.status_code)


@app.exception_handler(Exception)
async def generic_exception_handler(_: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


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

import re

from fastapi import APIRouter, HTTPException, Request

from models.schemas import LoginPayload, RegisterPayload, success_response
from services.audit_service import log_audit_event
from services.auth_service import (
    clear_auth_cookie,
    create_token,
    hash_password,
    set_auth_cookie,
    verify_password,
)
from services.db_service import execute, fetch_one
from services.login_protection_service import (
    assert_login_allowed,
    clear_login_failures,
    register_failed_login,
)

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _validate_email(email: str) -> str:
    normalized = email.strip().lower()
    if not EMAIL_PATTERN.match(normalized):
        raise HTTPException(status_code=400, detail="Email invalido.")
    return normalized


def _validate_password_strength(password: str) -> None:
    has_letter = any(character.isalpha() for character in password)
    has_number = any(character.isdigit() for character in password)
    if not has_letter or not has_number:
        raise HTTPException(
            status_code=400,
            detail="Senha fraca. Use pelo menos 8 caracteres com letras e numeros.",
        )


def _resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@router.post("/register")
def register(payload: RegisterPayload):
    email = _validate_email(payload.email)
    _validate_password_strength(payload.password)
    existing_user = fetch_one("SELECT id FROM users WHERE email = %s", (email,))
    if existing_user:
        raise HTTPException(status_code=409, detail="Email ja cadastrado.")

    user = execute(
        """
        INSERT INTO users (email, password_hash)
        VALUES (%s, %s)
        RETURNING id, email, created_at
        """,
        (email, hash_password(payload.password)),
    )

    public_user = {
        "id": str(user["id"]),
        "email": user["email"],
        "created_at": user["created_at"].isoformat(),
    }
    response = success_response(public_user, status_code=201)
    set_auth_cookie(response, create_token(public_user))
    return response


@router.post("/login")
def login(payload: LoginPayload, request: Request):
    email = _validate_email(payload.email)
    client_ip = _resolve_client_ip(request)
    assert_login_allowed(email, client_ip)

    user = fetch_one(
        "SELECT id, email, password_hash, created_at FROM users WHERE email = %s",
        (email,),
    )

    if not user or not verify_password(payload.password, user["password_hash"]):
        register_failed_login(email, client_ip)
        log_audit_event(
            action="auth.login_failed",
            actor_id=None,
            request_id=getattr(request.state, "request_id", None),
            status="denied",
            metadata={"client_ip": client_ip},
        )
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")

    clear_login_failures(email, client_ip)

    public_user = {
        "id": str(user["id"]),
        "email": user["email"],
        "created_at": user["created_at"].isoformat(),
    }
    response = success_response(public_user)
    set_auth_cookie(response, create_token(public_user))

    log_audit_event(
        action="auth.login_success",
        actor_id=public_user["id"],
        request_id=getattr(request.state, "request_id", None),
        status="ok",
        metadata={"client_ip": client_ip},
    )

    return response


@router.get("/me")
def me(request: Request):
    from services.auth_service import get_current_user

    user = get_current_user(request)
    user["id"] = str(user["id"])
    user["created_at"] = user["created_at"].isoformat()
    return success_response(user)


@router.post("/logout")
def logout():
    response = success_response({"logged_out": True})
    clear_auth_cookie(response)
    return response

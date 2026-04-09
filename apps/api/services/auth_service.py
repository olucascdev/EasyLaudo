import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import Response

from services.db_service import fetch_one

AUTH_COOKIE_NAME = "easylaudo_token"
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7


def _is_truthy(value: str | None) -> bool:
    if not value:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _secret_key() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET nao configurada.")
    if len(secret) < 32:
        raise RuntimeError("JWT_SECRET deve ter ao menos 32 caracteres.")
    return secret


def _cookie_samesite() -> str:
    samesite = (os.getenv("COOKIE_SAMESITE") or "lax").strip().lower()
    if samesite not in {"lax", "strict", "none"}:
        raise RuntimeError("COOKIE_SAMESITE deve ser lax, strict ou none.")
    return samesite


def validate_security_config() -> None:
    _secret_key()
    samesite = _cookie_samesite()
    secure_cookie = _is_truthy(os.getenv("COOKIE_SECURE", "true"))
    if samesite == "none" and not secure_cookie:
        raise RuntimeError("COOKIE_SECURE deve ser true quando COOKIE_SAMESITE=none.")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000
    )
    return f"{salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, expected = password_hash.split("$", 1)
    except ValueError:
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000
    )
    return hmac.compare_digest(digest.hex(), expected)


def create_token(user: dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }

    header_part = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    payload_part = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{header_part}.{payload_part}".encode("utf-8")
    signature = hmac.new(
        _secret_key().encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    signature_part = _b64url_encode(signature)

    return f"{header_part}.{payload_part}.{signature_part}"


def decode_token(token: str) -> dict[str, Any]:
    try:
        header_part, payload_part, signature_part = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Token invalido.") from exc

    signing_input = f"{header_part}.{payload_part}".encode("utf-8")
    expected_signature = hmac.new(
        _secret_key().encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    if not hmac.compare_digest(_b64url_encode(expected_signature), signature_part):
        raise HTTPException(status_code=401, detail="Token invalido.")

    try:
        payload = json.loads(_b64url_decode(payload_part))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Token invalido.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=401, detail="Token invalido.")

    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(status_code=401, detail="Sessao expirada.")

    return payload


def set_auth_cookie(response: Response, token: str) -> None:
    secure_cookie = _is_truthy(os.getenv("COOKIE_SECURE", "true"))
    samesite = _cookie_samesite()
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite=samesite,
        max_age=TOKEN_TTL_SECONDS,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    secure_cookie = _is_truthy(os.getenv("COOKIE_SECURE", "true"))
    samesite = _cookie_samesite()
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        secure=secure_cookie,
        samesite=samesite,
    )


def get_current_user(request: Request):
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Nao autenticado.")

    payload = decode_token(token)
    user = fetch_one(
        "SELECT id, email, created_at FROM users WHERE id = %s",
        (payload["sub"],),
    )

    if not user:
        raise HTTPException(status_code=401, detail="Usuario nao encontrado.")

    return dict(user)

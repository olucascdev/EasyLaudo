#!/usr/bin/env python3
import io
import os
import zipfile
from contextlib import contextmanager

from fastapi import HTTPException

from routers.compliance import _require_maintenance_token
from services.auth_service import (
    create_token,
    decode_token,
    validate_security_config as validate_auth_config,
)
from services.ia_service import extrair_com_ia
from services.login_protection_service import (
    assert_login_allowed,
    clear_login_failures,
    register_failed_login,
)
from services.rate_limit_service import check_rate_limit
from services.storage_service import resolve_storage_path
from services.upload_security_service import validate_docx_upload


@contextmanager
def temp_env(values: dict[str, str | None]):
    previous = {key: os.getenv(key) for key in values}
    try:
        for key, value in values.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        yield
    finally:
        for key, old in previous.items():
            if old is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = old


def _expect_exception(fn, exc_type):
    try:
        fn()
    except exc_type:
        return True
    return False


def test_jwt_requires_strong_secret():
    with temp_env(
        {"JWT_SECRET": None, "COOKIE_SAMESITE": "lax", "COOKIE_SECURE": "true"}
    ):
        if not _expect_exception(validate_auth_config, RuntimeError):
            raise AssertionError("JWT_SECRET ausente deveria falhar.")

    with temp_env(
        {
            "JWT_SECRET": "segredo-curto",
            "COOKIE_SAMESITE": "lax",
            "COOKIE_SECURE": "true",
        }
    ):
        if not _expect_exception(validate_auth_config, RuntimeError):
            raise AssertionError("JWT_SECRET curto deveria falhar.")


def test_jwt_tampering_is_blocked():
    with temp_env(
        {
            "JWT_SECRET": "12345678901234567890123456789012",
            "COOKIE_SAMESITE": "lax",
            "COOKIE_SECURE": "true",
        }
    ):
        token = create_token({"id": "user-1", "email": "u@example.com"})
        parts = token.split(".")
        tampered = f"{parts[0]}.{parts[1]}x.{parts[2]}"
        if not _expect_exception(lambda: decode_token(tampered), HTTPException):
            raise AssertionError("Token adulterado deveria ser rejeitado.")


def test_path_traversal_is_blocked():
    if not _expect_exception(
        lambda: resolve_storage_path("../../etc/passwd"), ValueError
    ):
        raise AssertionError("Path traversal deveria ser bloqueado.")


def _build_fake_docx_with_zip_bomb_pattern() -> bytes:
    content = io.BytesIO()
    with zipfile.ZipFile(
        content, mode="w", compression=zipfile.ZIP_DEFLATED
    ) as archive:
        archive.writestr("[Content_Types].xml", "<Types></Types>")
        archive.writestr("word/document.xml", "<w:doc></w:doc>")
        archive.writestr("word/payload.txt", "A" * (1024 * 1024))
    return content.getvalue()


def test_malicious_docx_is_blocked():
    payload = _build_fake_docx_with_zip_bomb_pattern()
    with temp_env(
        {
            "MAX_UPLOAD_BYTES": "2097152",
            "MAX_ZIP_FILES": "10",
            "MAX_ZIP_UNCOMPRESSED_BYTES": "200000",
            "MAX_ZIP_COMPRESSION_RATIO": "10",
        }
    ):
        if not _expect_exception(
            lambda: validate_docx_upload("ataque.docx", "application/zip", payload),
            HTTPException,
        ):
            raise AssertionError("DOCX suspeito deveria ser bloqueado.")


def test_rate_limit_blocks_excess():
    with temp_env({"RATE_LIMIT_GENERAL_PER_MIN": "2"}):
        ok1, _ = check_rate_limit("/qualquer", "10.10.10.10")
        ok2, _ = check_rate_limit("/qualquer", "10.10.10.10")
        ok3, _ = check_rate_limit("/qualquer", "10.10.10.10")
        if not ok1 or not ok2 or ok3:
            raise AssertionError("Rate limit deveria bloquear a 3a chamada.")


def test_login_lockout_blocks_bruteforce():
    with temp_env(
        {
            "LOGIN_LOCKOUT_FAILURES": "2",
            "LOGIN_LOCKOUT_SECONDS": "30",
            "LOGIN_REPEATED_LOCKOUT_SECONDS": "60",
            "LOGIN_ATTEMPT_TTL_SECONDS": "600",
        }
    ):
        email = "ataque@example.com"
        ip = "9.9.9.9"
        clear_login_failures(email, ip)
        register_failed_login(email, ip)
        register_failed_login(email, ip)
        if not _expect_exception(
            lambda: assert_login_allowed(email, ip), HTTPException
        ):
            raise AssertionError("Lockout deveria bloquear novas tentativas.")


def test_ai_extraction_can_be_disabled():
    with temp_env({"ALLOW_AI_EXTRACTION": "false", "CLAUDE_API_KEY": None}):
        if not _expect_exception(
            lambda: extrair_com_ia("texto", ["nome"]), RuntimeError
        ):
            raise AssertionError("Extracao IA desabilitada deveria falhar.")


def test_maintenance_token_required():
    with temp_env({"MAINTENANCE_TOKEN": "token-seguro"}):
        if not _expect_exception(
            lambda: _require_maintenance_token("errado"), HTTPException
        ):
            raise AssertionError("Token incorreto deveria ser bloqueado.")


def run():
    tests = [
        ("JWT secret forte obrigatorio", test_jwt_requires_strong_secret),
        ("Token adulterado bloqueado", test_jwt_tampering_is_blocked),
        ("Path traversal bloqueado", test_path_traversal_is_blocked),
        ("Upload DOCX malicioso bloqueado", test_malicious_docx_is_blocked),
        ("Rate limiting ativo", test_rate_limit_blocks_excess),
        ("Lockout anti-bruteforce ativo", test_login_lockout_blocks_bruteforce),
        ("IA pode ser desabilitada", test_ai_extraction_can_be_disabled),
        ("Endpoint de manutencao exige token", test_maintenance_token_required),
    ]

    passed = 0
    failed = []
    for name, test_fn in tests:
        try:
            test_fn()
            print(f"[OK] {name}")
            passed += 1
        except Exception as exc:
            print(f"[FAIL] {name}: {exc}")
            failed.append((name, str(exc)))

    print("---")
    print(f"Total: {len(tests)}")
    print(f"Aprovados: {passed}")
    print(f"Falhas: {len(failed)}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    run()

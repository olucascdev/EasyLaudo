import hashlib
import os
import time
from dataclasses import dataclass
from threading import Lock

from fastapi import HTTPException


def _positive_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value == "":
        return default

    try:
        parsed = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} deve ser um inteiro positivo.") from exc

    if parsed <= 0:
        raise RuntimeError(f"{name} deve ser maior que zero.")

    return parsed


@dataclass
class LoginAttemptState:
    failed_count: int = 0
    lock_until: float = 0.0
    lockouts_today: int = 0
    lockouts_day: int = 0


_ATTEMPTS: dict[str, LoginAttemptState] = {}
_LOCK = Lock()


def validate_security_config() -> None:
    _positive_int_env("LOGIN_LOCKOUT_FAILURES", 5)
    _positive_int_env("LOGIN_LOCKOUT_SECONDS", 15 * 60)
    _positive_int_env("LOGIN_REPEATED_LOCKOUT_SECONDS", 60 * 60)
    _positive_int_env("LOGIN_ATTEMPT_TTL_SECONDS", 24 * 60 * 60)


def _hashed_email(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def _keys(email: str, client_ip: str) -> tuple[str, str]:
    return (f"email:{_hashed_email(email)}", f"ip:{client_ip}")


def _evict_expired(now: float, ttl_seconds: int) -> None:
    expired_keys = []
    for key, state in _ATTEMPTS.items():
        if state.failed_count == 0 and state.lock_until < (now - ttl_seconds):
            expired_keys.append(key)
    for key in expired_keys:
        _ATTEMPTS.pop(key, None)


def _touch_lockout(state: LoginAttemptState, now: float) -> None:
    day = int(now // 86400)
    if day != state.lockouts_day:
        state.lockouts_day = day
        state.lockouts_today = 0


def assert_login_allowed(email: str, client_ip: str) -> None:
    now = time.time()
    ttl_seconds = _positive_int_env("LOGIN_ATTEMPT_TTL_SECONDS", 24 * 60 * 60)

    with _LOCK:
        _evict_expired(now, ttl_seconds)
        for key in _keys(email, client_ip):
            state = _ATTEMPTS.get(key)
            if state and state.lock_until > now:
                retry_after = int(max(1, state.lock_until - now))
                raise HTTPException(
                    status_code=429,
                    detail=f"Muitas tentativas. Tente novamente em {retry_after} segundos.",
                )


def register_failed_login(email: str, client_ip: str) -> None:
    now = time.time()
    failures = _positive_int_env("LOGIN_LOCKOUT_FAILURES", 5)
    first_lock_seconds = _positive_int_env("LOGIN_LOCKOUT_SECONDS", 15 * 60)
    repeated_lock_seconds = _positive_int_env("LOGIN_REPEATED_LOCKOUT_SECONDS", 60 * 60)
    ttl_seconds = _positive_int_env("LOGIN_ATTEMPT_TTL_SECONDS", 24 * 60 * 60)

    with _LOCK:
        _evict_expired(now, ttl_seconds)
        for key in _keys(email, client_ip):
            state = _ATTEMPTS.setdefault(key, LoginAttemptState())
            _touch_lockout(state, now)

            if state.lock_until > now:
                continue

            state.failed_count += 1
            if state.failed_count >= failures:
                lock_seconds = (
                    repeated_lock_seconds
                    if state.lockouts_today > 0
                    else first_lock_seconds
                )
                state.lock_until = now + lock_seconds
                state.failed_count = 0
                state.lockouts_today += 1


def clear_login_failures(email: str, client_ip: str) -> None:
    with _LOCK:
        for key in _keys(email, client_ip):
            _ATTEMPTS.pop(key, None)

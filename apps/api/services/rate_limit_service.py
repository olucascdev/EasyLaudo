import os
import time
from collections import defaultdict, deque
from threading import Lock


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


_STORE: dict[str, deque[float]] = defaultdict(deque)
_LOCK = Lock()


def validate_security_config() -> None:
    _positive_int_env("RATE_LIMIT_AUTH_PER_MIN", 20)
    _positive_int_env("RATE_LIMIT_UPLOAD_PER_MIN", 30)
    _positive_int_env("RATE_LIMIT_GENERAL_PER_MIN", 120)


def _resolve_limit(path: str) -> tuple[str, int, int]:
    auth_limit = _positive_int_env("RATE_LIMIT_AUTH_PER_MIN", 20)
    upload_limit = _positive_int_env("RATE_LIMIT_UPLOAD_PER_MIN", 30)
    general_limit = _positive_int_env("RATE_LIMIT_GENERAL_PER_MIN", 120)

    if path.startswith("/auth/"):
        return ("auth", auth_limit, 60)

    if path in {
        "/planilha/upload",
        "/modelo/processar-upload",
        "/extracao/processar",
    }:
        return ("upload", upload_limit, 60)

    return ("general", general_limit, 60)


def check_rate_limit(path: str, client_key: str) -> tuple[bool, int]:
    category, limit, window_seconds = _resolve_limit(path)
    key = f"{category}:{client_key}"
    now = time.monotonic()
    oldest_allowed = now - window_seconds

    with _LOCK:
        queue = _STORE[key]
        while queue and queue[0] < oldest_allowed:
            queue.popleft()

        if not queue and key in _STORE:
            _STORE.pop(key, None)
            queue = _STORE[key]

        if len(queue) >= limit:
            retry_after = max(1, int(window_seconds - (now - queue[0])))
            return (False, retry_after)

        queue.append(now)

    return (True, 0)

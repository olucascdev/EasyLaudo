import os
import re
import unicodedata
from pathlib import Path
from uuid import uuid4


def _base_storage_path() -> Path:
    configured = Path(os.getenv("STORAGE_PATH", "storage"))
    if configured.is_absolute():
        return configured
    return Path.cwd() / configured


def ensure_storage() -> Path:
    base_path = _base_storage_path()
    base_path.mkdir(parents=True, exist_ok=True)
    return base_path


def sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    normalized = (
        unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    )
    normalized = re.sub(r"[^a-zA-Z0-9._-]+", "_", normalized).strip("._")
    return normalized or "arquivo"


def save_upload(user_id: str, category: str, filename: str, content: bytes) -> str:
    base_path = ensure_storage()
    target_dir = base_path / user_id / category
    target_dir.mkdir(parents=True, exist_ok=True)

    safe_name = sanitize_filename(filename)
    final_name = f"{uuid4().hex}_{safe_name}"
    final_path = target_dir / final_name
    final_path.write_bytes(content)

    return str(final_path.relative_to(base_path))


def save_bytes(user_id: str, category: str, filename: str, content: bytes) -> str:
    return save_upload(
        user_id=user_id, category=category, filename=filename, content=content
    )


def resolve_storage_path(relative_path: str) -> Path:
    base_path = ensure_storage().resolve()
    candidate = Path(relative_path)
    if candidate.is_absolute():
        raise ValueError("Caminho absoluto nao permitido no storage.")

    resolved_path = (base_path / candidate).resolve()
    try:
        resolved_path.relative_to(base_path)
    except ValueError as exc:
        raise ValueError("Caminho invalido para storage.") from exc

    return resolved_path


def delete_file(relative_path: str | None) -> None:
    if not relative_path:
        return

    target_path = resolve_storage_path(relative_path)
    if target_path.exists():
        target_path.unlink()


def read_file_bytes(relative_path: str) -> bytes:
    return resolve_storage_path(relative_path).read_bytes()

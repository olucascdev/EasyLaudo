import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from services.db_service import execute, fetch_all
from services.storage_service import ensure_storage


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


def retention_policy() -> dict[str, int]:
    return {
        "editor_drafts_days": _positive_int_env("RETENTION_EDITOR_DRAFTS_DAYS", 30),
        "spreadsheets_days": _positive_int_env("RETENTION_SPREADSHEETS_DAYS", 180),
        "reports_days": _positive_int_env("RETENTION_REPORTS_DAYS", 365),
        "temporary_files_days": _positive_int_env("RETENTION_TEMP_FILES_DAYS", 7),
    }


def validate_security_config() -> None:
    retention_policy()


def _delete_paths(paths: list[str], dry_run: bool) -> int:
    deleted = 0
    base_path = ensure_storage().resolve()
    for relative_path in paths:
        if not relative_path:
            continue

        candidate = Path(relative_path)
        if candidate.is_absolute():
            continue

        target = (base_path / candidate).resolve()
        try:
            target.relative_to(base_path)
        except ValueError:
            continue

        if target.exists():
            if dry_run:
                deleted += 1
            else:
                target.unlink()
                deleted += 1
    return deleted


def _cleanup_table_with_file(
    *,
    table_name: str,
    ttl_days: int,
    dry_run: bool,
) -> dict[str, int]:
    rows = fetch_all(
        f"""
        SELECT id, file_path
        FROM {table_name}
        WHERE created_at < NOW() - (%s::text || ' days')::interval
        """,
        (ttl_days,),
    )
    ids = [str(row["id"]) for row in rows]
    paths = [row.get("file_path") for row in rows if row.get("file_path")]

    if not dry_run:
        for row_id in ids:
            execute(f"DELETE FROM {table_name} WHERE id = %s", (row_id,))

    deleted_files = _delete_paths(paths, dry_run=dry_run)
    return {
        "rows": len(ids),
        "files": deleted_files,
    }


def _cleanup_editor_drafts(ttl_days: int, dry_run: bool) -> int:
    rows = fetch_all(
        """
        SELECT id
        FROM editor_drafts
        WHERE updated_at < NOW() - (%s::text || ' days')::interval
        """,
        (ttl_days,),
    )
    ids = [str(row["id"]) for row in rows]

    if not dry_run:
        for row_id in ids:
            execute("DELETE FROM editor_drafts WHERE id = %s", (row_id,))

    return len(ids)


def _cleanup_temporary_files(ttl_days: int, dry_run: bool) -> int:
    categories = {"template_drafts", "extractions"}
    deadline = datetime.now(timezone.utc) - timedelta(days=ttl_days)
    base_path = ensure_storage()
    deleted = 0

    for user_dir in base_path.iterdir():
        if not user_dir.is_dir():
            continue

        for category in categories:
            category_dir = user_dir / category
            if not category_dir.exists() or not category_dir.is_dir():
                continue

            for item in category_dir.iterdir():
                if not item.is_file():
                    continue

                modified_at = datetime.fromtimestamp(
                    item.stat().st_mtime, tz=timezone.utc
                )
                if modified_at < deadline:
                    if dry_run:
                        deleted += 1
                    else:
                        item.unlink()
                        deleted += 1

            if not dry_run:
                try:
                    category_dir.rmdir()
                except OSError:
                    pass

    if not dry_run:
        _cleanup_empty_user_directories(base_path)

    return deleted


def _cleanup_empty_user_directories(base_path: Path) -> None:
    for user_dir in base_path.iterdir():
        if not user_dir.is_dir():
            continue
        try:
            user_dir.rmdir()
        except OSError:
            continue


def run_retention_cleanup(*, dry_run: bool = False) -> dict:
    policy = retention_policy()

    spreadsheets = _cleanup_table_with_file(
        table_name="spreadsheets",
        ttl_days=policy["spreadsheets_days"],
        dry_run=dry_run,
    )
    reports = _cleanup_table_with_file(
        table_name="reports",
        ttl_days=policy["reports_days"],
        dry_run=dry_run,
    )
    drafts_deleted = _cleanup_editor_drafts(
        ttl_days=policy["editor_drafts_days"],
        dry_run=dry_run,
    )
    temporary_files_deleted = _cleanup_temporary_files(
        ttl_days=policy["temporary_files_days"],
        dry_run=dry_run,
    )

    if not dry_run:
        _cleanup_orphan_templates()

    return {
        "dry_run": dry_run,
        "policy": policy,
        "deleted": {
            "spreadsheets": spreadsheets,
            "reports": reports,
            "editor_drafts": drafts_deleted,
            "temporary_files": temporary_files_deleted,
        },
    }


def _cleanup_orphan_templates() -> None:
    rows = fetch_all(
        """
        SELECT t.id
        FROM templates t
        LEFT JOIN mappings m ON m.template_id = t.id
        LEFT JOIN reports r ON r.template_id = t.id
        WHERE m.id IS NULL AND r.id IS NULL
          AND t.created_at < NOW() - INTERVAL '365 days'
        """
    )
    if not rows:
        return

    for row in rows:
        execute("DELETE FROM templates WHERE id = %s", (str(row["id"]),))

import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("easylaudo.audit")


def log_audit_event(
    *,
    action: str,
    actor_id: str | None,
    request_id: str | None,
    status: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    payload = {
        "at": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "actor_id": actor_id,
        "request_id": request_id,
        "status": status,
        "metadata": metadata or {},
    }
    logger.info("audit_event=%s", json.dumps(payload, separators=(",", ":")))

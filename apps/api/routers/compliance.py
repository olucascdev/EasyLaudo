import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from models.schemas import success_response
from services.audit_service import log_audit_event
from services.auth_service import get_current_user
from services.retention_service import retention_policy, run_retention_cleanup

router = APIRouter(prefix="/compliance", tags=["compliance"])


def _require_maintenance_token(token: str | None) -> None:
    configured = os.getenv("MAINTENANCE_TOKEN", "")
    if not configured:
        raise HTTPException(
            status_code=503,
            detail="Execucao de manutencao desabilitada: MAINTENANCE_TOKEN nao configurado.",
        )
    if token != configured:
        raise HTTPException(status_code=401, detail="Token de manutencao invalido.")


@router.post("/retention/run")
def executar_retencao(
    request: Request,
    dry_run: bool = True,
    x_maintenance_token: str | None = Header(default=None),
):
    _require_maintenance_token(x_maintenance_token)
    summary = run_retention_cleanup(dry_run=dry_run)

    log_audit_event(
        action="compliance.retention_run",
        actor_id="maintenance",
        request_id=getattr(request.state, "request_id", None),
        status="ok",
        metadata={"dry_run": dry_run, "deleted": summary.get("deleted", {})},
    )

    return success_response(summary)


@router.get("/retention/policy")
def politica_retencao_admin(current_user=Depends(get_current_user)):
    _ = current_user
    return success_response(retention_policy())

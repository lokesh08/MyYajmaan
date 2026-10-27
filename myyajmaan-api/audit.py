import logging
from typing import Any, Optional

from db import service_supabase

logger = logging.getLogger(__name__)


def write_audit_log(
    action: str,
    actor_id: Optional[str] = None,
    entity: Optional[str] = None,
    entity_id: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
) -> None:
    """
    Generic audit logger.

    Do not include:
    - passwords
    - access tokens
    - refresh tokens
    - service-role keys
    - payment secrets
    """

    if service_supabase is None:
        logger.warning(
            "Audit log skipped because Supabase service client is unavailable."
        )
        return

    safe_payload = payload or {}

    try:
        result = (
            service_supabase
            .table("audit_logs")
            .insert({
                "actor_id": actor_id,
                "action": action,
                "entity": entity,
                "entity_id": entity_id,
                "payload": safe_payload,
            })
            .execute()
        )

        if getattr(result, "error", None):
            logger.error(
                "Audit insert failed for action %s: %s",
                action,
                result.error,
            )

    except Exception:
        logger.exception(
            "Unexpected audit logging failure for action %s",
            action,
        )
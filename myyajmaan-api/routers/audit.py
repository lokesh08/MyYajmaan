from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from auth import get_current_user
from db import service_supabase
from permissions import require_admin_roles

router = APIRouter(
    prefix="/audit",
    tags=["audit"],
)


class AuditEventIn(BaseModel):
    action: str = Field(
        min_length=1,
        max_length=100,
    )
    entity: Optional[str] = Field(
        default=None,
        max_length=100,
    )
    entity_id: Optional[str] = Field(
        default=None,
        max_length=200,
    )
    payload: dict[str, Any] = Field(
        default_factory=dict,
    )


@router.post("/events")
async def create_audit_event(
    event: AuditEventIn,
    current_user: dict = Depends(
        require_admin_roles("support_admin")
    ),
):
    write_audit_log(
        action=event.action,
        actor_id=str(current_user["id"]),
        entity=event.entity,
        entity_id=event.entity_id,
        payload=event.payload,
    )

    return {
        "message": "Audit event recorded.",
    }


@router.get("/events")
async def list_audit_events(
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    action: Optional[str] = Query(default=None),
    entity: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    current_user: dict = Depends(
        require_admin_roles("support_admin")
    ),
):
    """
    Return audit history to administrators with support access.

    `limit` (no pagination) is kept for backward compatibility with
    any existing caller; when omitted, results are paginated via
    `page`/`page_size` instead, with actor names resolved for display.
    """
    if service_supabase is None:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "DATABASE_NOT_CONFIGURED",
                "message": "Audit history is not configured.",
            },
        )

    query = service_supabase.table("audit_logs").select(
        "id, actor_id, action, entity, entity_id, payload, created_at",
        count="exact",
    )

    if action:
        query = query.ilike("action", f"%{action.strip()}%")
    if entity:
        query = query.eq("entity", entity)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)

    if limit is not None:
        result = query.order("created_at", desc=True).limit(limit).execute()
        events = getattr(result, "data", None) or []
        return {"events": events}

    start = (page - 1) * page_size
    end = start + page_size - 1
    result = query.order("created_at", desc=True).range(start, end).execute()
    events = getattr(result, "data", None) or []
    total = getattr(result, "count", None) or 0

    actor_ids = [e["actor_id"] for e in events if e.get("actor_id")]
    actors_by_id = {}
    if actor_ids:
        actors_resp = (
            service_supabase
            .table("users")
            .select("id, full_name, email, role")
            .in_("id", actor_ids)
            .execute()
        )
        actors_by_id = {
            a["id"]: {"full_name": a.get("full_name"), "email": a.get("email"), "role": a.get("role")}
            for a in (getattr(actors_resp, "data", None) or [])
        }

    for event in events:
        event["actor"] = actors_by_id.get(event.get("actor_id"))

    return {
        "items": events,
        "total": total,
        "page": page,
        "page_size": page_size,
    }